import { createContext, useContext } from 'react';

/**
 * Guarda uma imagem nova e devolve a `src` que vai para o anúncio. Com a API local, grava em
 * Anuncios/<projeto>/imagens (criando a pasta na primeira vez); sem ela, devolve o próprio data URL.
 */
export type StoreImage = (dataUrl: string, hint: string) => Promise<string>;

export const AssetContext = createContext<StoreImage>(async (dataUrl) => dataUrl);

export const useStoreImage = () => useContext(AssetContext);
