import { mockConfigService } from '@common/test/mock-config.service';
import { createMockPrismaService } from '@common/test/mock-prisma.service';
import * as crypto from '@common/utils/crypto';
import * as jwt from '@common/utils/jwt';
import { Prisma } from '@db/client';
import { AuthService } from '@modules/auth/auth.service';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerUser', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      name: 'John Doe',
      password: 'test123',
    };

    it('should register and return tokens', async () => {
      const createdUser = {
        id: 'user-id',
        email: registerDto.email,
        name: registerDto.name,
        role: 'USER',
        isActive: true,
        stripeCustomerId: null,
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.session.create.mockResolvedValue({});

      const result = await authService.registerUser(registerDto);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should rethrow P2002 on duplicate email', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['email'] },
        },
      );

      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(authService.registerUser(registerDto)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });

    it('should rethrow unknown errors', async () => {
      mockPrisma.user.create.mockRejectedValue(new Error('connection failed'));
      await expect(authService.registerUser(registerDto)).rejects.toThrow(
        'connection failed',
      );
    });
  });

  describe('validateUser', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'test123',
    };

    const user = {
      id: 'user-id',
      email: loginDto.email,
      name: 'John Doe',
      role: 'USER',
      isActive: true,
      stripeCustomerId: null,
      passwordHash: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return user on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      jest.spyOn(crypto, 'verifyPassword').mockResolvedValue(true);

      const result = await authService.validateUser(loginDto);
      expect(result).toEqual(user);
    });

    it('should throw on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(user);
      jest.spyOn(crypto, 'verifyPassword').mockResolvedValue(false);

      await expect(authService.validateUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw on nonexistent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.validateUser(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('loginUser', () => {
    it('should return tokens', async () => {
      mockPrisma.session.create.mockResolvedValue({});

      const result = await authService.loginUser(
        {
          id: 'user-id',
          email: 'test@example.com',
          name: 'John Doe',
          role: 'USER',
          isActive: true,
          stripeCustomerId: null,
          passwordHash: 'hashed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        '127.0.0.1',
        'Chrome',
      );
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-id',
          ipAddress: '127.0.0.1',
          userAgent: 'Chrome',
        }),
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('refreshSession', () => {
    const user = {
      id: 'user-id',
      email: 'test@example.com',
      name: 'John Doe',
      role: 'USER',
      isActive: true,
      stripeCustomerId: null,
      passwordHash: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const session = {
      id: 'session-id',
      userId: 'user-id',
      refreshTokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Chrome',
      user,
    };

    const refreshToken = 'refresh-token';

    it('should return new tokens', async () => {
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValue({
        sub: user.id,
        sid: session.id,
      });
      mockPrisma.session.findFirst.mockResolvedValue(session);
      jest.spyOn(crypto, 'verifyValue').mockResolvedValue(true);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await authService.refreshSession(refreshToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw on invalid refresh token', async () => {
      jest.spyOn(jwt, 'verifyRefreshToken').mockImplementation(() => {
        throw new Error();
      });

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw on invalid session', async () => {
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValue({
        sub: user.id,
        sid: session.id,
      });

      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw on invalid refresh token hash and revoke the session', async () => {
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValue({
        sub: user.id,
        sid: session.id,
      });
      mockPrisma.session.findFirst.mockResolvedValue(session);
      jest.spyOn(crypto, 'verifyValue').mockResolvedValue(false);
      mockPrisma.session.update.mockResolvedValue({});

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: session.id },
        data: { revoked: true },
      });
    });

    it('should throw on refresh token reuse', async () => {
      jest.spyOn(jwt, 'verifyRefreshToken').mockReturnValue({
        sub: user.id,
        sid: session.id,
      });
      mockPrisma.session.findFirst.mockResolvedValue(session);
      jest.spyOn(crypto, 'verifyValue').mockResolvedValue(true);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.refreshSession(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke session', async () => {
      mockPrisma.session.update.mockResolvedValue({});

      await authService.logout('session-id');

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-id' },
        data: { revoked: true },
      });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all active sessions for user', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({});

      await authService.logoutAll('user-id');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', revoked: false },
        data: { revoked: true },
      });
    });
  });
});
