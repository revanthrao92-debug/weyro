import { extractMediaKey, isMediaKey } from './media-key';

describe('media keys (C3)', () => {
  const key = 'damage-requests/0b6c1f1e-1111-4222-8333-444455556666/1700000000000_ab12cd34.jpg';

  it('recognizes storage keys and rejects traversal / foreign paths', () => {
    expect(isMediaKey(key)).toBe(true);
    expect(isMediaKey('avatars/u1/x.png')).toBe(true);
    expect(isMediaKey('etc/passwd')).toBe(false);
    expect(isMediaKey('avatars/../secrets/x.png')).toBe(false);
    expect(isMediaKey('avatars//x.png')).toBe(false);
    expect(isMediaKey('')).toBe(false);
  });

  it('extracts the key from a legacy virtual-host S3 presigned URL', () => {
    const url = `https://bkt.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Expires=604800&X-Amz-Signature=abc`;
    expect(extractMediaKey(url)).toBe(key);
  });

  it('extracts the key from a path-style URL with a bucket prefix', () => {
    expect(extractMediaKey(`https://storage.example.com/weyro-uploads/${key}?X-Amz-Signature=abc`)).toBe(key);
  });

  it('extracts the key from a local dev driver URL', () => {
    const url = `http://localhost:4000/api/v1/uploads/local-file?key=${encodeURIComponent(key)}&token=1.abc`;
    expect(extractMediaKey(url)).toBe(key);
  });

  it('returns null for external images and traversal attempts', () => {
    expect(extractMediaKey('https://images.unsplash.com/photo-1?w=400')).toBeNull();
    expect(
      extractMediaKey('http://x/api/v1/uploads/local-file?key=..%2F..%2Fetc%2Fpasswd&token=1.a'),
    ).toBeNull();
  });

});
