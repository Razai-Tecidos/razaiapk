// Catalog module types
// These are initial scaffolds; fields are optional to avoid breaking existing data.

export type CatalogTag = string;

export interface CatalogFilters {
  search?: string; // free-text search across tissue/color/pattern names
  fabricType?: string; // e.g., "malha", "satin", "denim"
  families?: string[]; // color or pattern families
  tags?: CatalogTag[];
  onlyActive?: boolean; // filter active links
  minWidth?: number;
  maxWidth?: number;
}

export interface CatalogItemColor {
  colorId: number;
  colorName: string;
  colorSku: string;
  hex: string;
  family: string;
}

export interface CatalogItemPattern {
  patternId: number;
  patternName: string; // full name
  patternSku: string;
  family: string;
}

export interface CatalogItemLinkMeta {
  skuFilho: string;
  status: string; // Ativo/Inativo
  createdAt: string;
  imageThumb?: string; // existing data URL thumb
  imagePath?: string; // path or idb:<hash>
}

export interface CatalogItem {
  tissueId: number;
  tissueName: string;
  tissueSku: string;
  composition?: string;
  width?: number;
  fabricType?: string;
  gsm?: number;
  tags?: CatalogTag[];
  description?: string;
  supplier?: string;
  price?: number;
  currency?: string;
  season?: string; // e.g., "SS25", "FW25"
  colors: Array<CatalogItemColor & CatalogItemLinkMeta>;
  patterns: Array<CatalogItemPattern & CatalogItemLinkMeta>;
}

export interface CatalogPDFSectionConfig {
  columns?: number; // how many cards per row
  showPatterns?: boolean;
  showColors?: boolean;
  maxItemsPerPage?: number;
}

export interface CatalogPDFConfig {
  title?: string;
  includeCover?: boolean;
  coverImagePath?: string;
  sections?: CatalogPDFSectionConfig;
  dateLabel?: string; // e.g. new Date().toLocaleDateString()
  brandName?: string; // "RAZAI"
  author?: string; // who generated
  version?: string; // app version or catalog schema version
  showFooterPageNumbers?: boolean;
  showFooterBrand?: boolean;
}

export interface GenerateCatalogPdfParams {
  items: CatalogItem[];
  filtersApplied?: CatalogFilters;
  config?: CatalogPDFConfig;
}

export interface CatalogPdfResult {
  outputPath?: string; // for Tauri
  blob?: Blob; // for web
  fileName: string;
  error?: string; // user-friendly error when native save fails
  nativeSaveAttempted?: boolean; // whether a Tauri save was tried
  metadata?: {
    generatedAt: string;
    itemCount: number;
    colorsTotal: number;
    patternsTotal: number;
    filtersApplied?: CatalogFilters;
    version?: string;
    author?: string;
  };
}
