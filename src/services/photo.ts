/**
 * Prépare une photo pour l'analyse : JPEG, 1280 px maximum sur le grand côté, compression 0,7.
 * C'est assez pour reconnaître une assiette, et l'envoi reste léger (~120-200 Ko) sur un réseau
 * mobile lent. Si la mesure (server/eval) montre une perte de précision, remonte COTE_MAX.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const COTE_MAX = 1280;
const COMPRESSION = 0.7;

export async function preparerPhoto(photo: { uri: string; width: number; height: number }): Promise<{ uri: string; base64: string }> {
  const contexte = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > COTE_MAX) {
    contexte.resize(photo.width >= photo.height ? { width: COTE_MAX } : { height: COTE_MAX });
  }
  const image = await contexte.renderAsync();
  const resultat = await image.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESSION, base64: true });
  if (!resultat.base64) throw new Error('Photo illisible');
  return { uri: resultat.uri, base64: resultat.base64 };
}
