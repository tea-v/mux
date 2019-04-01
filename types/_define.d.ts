type PublicKey = { [key in 'alg' | 'e' | 'kid' | 'kty' | 'n' | 'use']: string };

declare const MOVIES_BUCKET_NAME: string;
declare const USER_POOL_PUBLIC_KEYS: PublicKey[];
declare const USER_POOL_URL: string;
