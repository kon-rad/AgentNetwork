import { generateNonce as siweGenerateNonce, SiweMessage } from "siwe";

export function generateNonce(): string {
  return siweGenerateNonce();
}

export async function verifySiweMessage(
  message: string,
  signature: string,
  nonce: string,
): Promise<{ success: boolean; address?: string; chainId?: number; error?: string }> {
  try {
    const siweMsg = new SiweMessage(message);
    const { success, data, error } = await siweMsg.verify({ signature, nonce });

    if (!success) {
      return { success: false, error: error?.type ?? "Invalid signature" };
    }

    return {
      success: true,
      address: data.address,
      chainId: data.chainId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return { success: false, error: message };
  }
}
