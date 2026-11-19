/**
 * Le catalogue envoyé au modèle de vision vit avec la base de l'app
 * (src/lib/vision.ts, construit depuis src/lib/aliments.ts et src/lib/plats.ts) :
 * une seule source de vérité, partagée par le serveur et l'app.
 */
export { idsAliments, texteCatalogue } from '../../src/lib/vision.ts';
