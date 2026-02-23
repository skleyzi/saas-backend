import argon2 from 'argon2';

export async function hashValue(value: string): Promise<string> {
  return await argon2.hash(value, { type: argon2.argon2id });
}

export async function verifyValue(
  value: string,
  storedHash: string,
): Promise<boolean> {
  return await argon2.verify(storedHash, value);
}

export async function hashPassword(password: string): Promise<string> {
  return await hashValue(password);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await verifyValue(password, hash);
}

export async function hashRefreshToken(token: string): Promise<string> {
  return await hashValue(token);
}

export async function verifyRefreshToken(
  token: string,
  hash: string,
): Promise<boolean> {
  return await verifyValue(token, hash);
}
