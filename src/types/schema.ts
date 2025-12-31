/**
 * Schema TypeScript para o sistema de Gestão Agrícola
 * Baseado nas tabelas do Supabase (PostgreSQL)
 */

// ============================================
// ENUMS
// ============================================

export enum ApplicationStatus {
  PLANNED = 'planned', // Planejado
  COMPLETED = 'completed', // Realizado
  CANCELLED = 'cancelled', // Cancelado
}

export enum StockMovementType {
  ENTRY = 'entry', // Entrada
  EXIT = 'exit', // Saída
}

// ============================================
// CORE ENTITIES
// ============================================

/**
 * Ano Safra - Período de cultivo
 */
export interface HarvestYear {
  id: string;
  farm_id: string;
  name: string; // Ex: "2024/2025"
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  active?: boolean;
  created_at: string;
  // Relations
  farm?: Farm;
}

/**
 * Ciclo de Safra - Ciclo dentro de um ano safra (Ex: Verão, Safrinha, Inverno)
 */
export interface HarvestCycle {
  id: string;
  harvest_year_id: string;
  name: string; // Ex: "Verão", "Safrinha", "Inverno", "Feijão das Águas"
  created_at: string;
  // Relations
  harvest_year?: HarvestYear;
}

/**
 * Fazenda
 */
export interface Farm {
  id: string;
  name: string;
  city?: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Cultura
 */
export interface Culture {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Talhão - Área de cultivo
 */
export interface Field {
  id: string;
  farm_id: string;
  name: string;
  area_hectares: number; // Área em hectares
  description?: string;
  created_at: string;
  updated_at: string;
  // Relations
  farm?: Farm;
  sub_fields?: SubField[];
}

/**
 * Sub-talhão
 */
export interface SubField {
  id: string;
  field_id: string;
  name: string;
  area_hectares: number;
  created_at: string;
  updated_at: string;
  // Relations
  field?: Field;
}

/**
 * Safra (Planejamento Macro) - Definição da safra
 */
export interface Crop {
  id: string;
  harvest_year_id: string;
  name: string; // Ex: "Soja Intacta"
  culture_id: string;
  variety?: string;
  cycle: string; // "Verão", "Inverno", "Safrinha"
  estimated_start_date?: string; // Janela Ideal Início
  estimated_end_date?: string; // Janela Ideal Fim
  created_at: string;
  // Relations
  harvest_year?: HarvestYear;
  culture?: Culture;
}

/**
 * Vínculo de Safra no Talhão (Execução)
 */
export interface FieldCrop {
  id: string;
  field_id: string;
  crop_id: string;
  status: 'PLANNED' | 'PLANTED';
  date_planted?: string | null;
  date_harvest_prediction?: string | null;
  created_at: string;
  // Relations
  field?: Field;
  crop?: Crop;
}

/**
 * Categoria de Produto
 */
export interface Category {
  id: string;
  name: string;
  type: 'predefined' | 'custom';
  group_name: 'defensivos' | 'adjuvantes' | 'custom';
  created_at: string;
}

/**
 * Produto - Defensivo agrícola
 */
export interface Product {
  id: string;
  name: string;
  company: string; // Empresa fabricante
  active_principle: string; // Princípio ativo
  unit: string; // Unidade (ex: "L", "kg")
  description?: string;
  created_at: string;
  updated_at: string;
  // Relations
  categories?: Category[];
}

/**
 * Fornecedor
 */
export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Entrada de Estoque - Registro de compra
 */
export interface StockEntry {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number; // Preço unitário
  total_price: number; // Preço total (quantity * unit_price)
  entry_date: string; // ISO date string
  invoice_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product;
  supplier?: Supplier;
}

/**
 * Estoque Atual (calculado dinamicamente)
 */
export interface CurrentStock {
  product_id: string;
  product?: Product;
  total_entries: number; // Soma de todas as entradas
  total_exits: number; // Soma de todas as saídas por aplicações realizadas
  current_stock: number; // Entradas - Saídas
  average_price: number; // Preço médio ponderado
  reserved_stock: number; // Estoque reservado por aplicações planejadas
  available_stock: number; // Estoque disponível (current_stock - reserved_stock)
}

/**
 * Aplicação - Registro de aplicação de defensivo
 */
export interface Application {
  id: string;
  name: string; // Nome da aplicação
  field_id: string;
  harvest_year_id: string;
  application_date: string; // ISO date string (data planejada ou realizada)
  status: ApplicationStatus;
  rate: number; // Taxa em L/ha
  nozzle: string; // Bico
  operator_name?: string;
  machine?: string;
  notes?: string;
  completed_at?: string; // ISO date string (quando foi realizada)
  created_at: string;
  updated_at: string;
  // Relations
  field?: Field;
  harvest_year?: HarvestYear;
  application_products?: ApplicationProduct[];
}

/**
 * Produtos da Aplicação - Relação muitos-para-muitos
 */
export interface ApplicationProduct {
  id: string;
  application_id: string;
  product_id: string;
  dosage: number; // Dosagem em L/ha ou kg/ha
  quantity_used: number; // Quantidade utilizada (calculada: dosage * field.area)
  created_at: string;
  // Relations
  product?: Product;
  application?: Application;
}

/**
 * Movimentação de Estoque (histórico)
 */
export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_price?: number; // Preço unitário (para entradas)
  reference_id?: string; // ID da entrada ou aplicação relacionada
  reference_type?: 'entry' | 'application'; // Tipo de referência
  movement_date: string; // ISO date string
  notes?: string;
  created_at: string;
  // Relations
  product?: Product;
}

/**
 * Maquinário - Pulverizador, Drone ou Avião
 */
export interface Machinery {
  id: string;
  user_id: string;
  name: string;
  type: 'pulverizador' | 'drone' | 'aviao';
  tank_capacity_liters: number;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Receita Prática - Receita gerada para aplicação no campo
 */
export interface PracticalRecipe {
  id: string;
  application_id: string;
  machinery_id: string;
  capacity_used_percent: number; // Percentual da capacidade usada
  application_rate_liters_per_hectare: number; // Taxa de aplicação (L/ha)
  liters_of_solution?: number; // Litros de calda definidos
  area_hectares?: number; // Área em hectares calculada
  multiplier: number; // Quantas vezes aplicar essa receita
  created_at: string;
  created_by: string;
  // Relations
  machinery?: Machinery;
  application?: Application;
  products?: PracticalRecipeProduct[];
}

/**
 * Produto da Receita Prática
 */
export interface PracticalRecipeProduct {
  id: string;
  practical_recipe_id: string;
  product_id: string;
  dosage: number; // Dosagem original do produto
  quantity_in_recipe: number; // Quantidade na receita
  remaining_quantity: number; // Quantidade restante após essa receita
  created_at: string;
  // Relations
  product?: Product;
  practical_recipe?: PracticalRecipe;
}

// ============================================
// DASHBOARD & REPORTS
// ============================================

/**
 * Resumo de custos por talhão
 */
export interface FieldCostSummary {
  field_id: string;
  field_name: string;
  total_applications: number;
  total_cost: number;
  applications_completed: number;
  applications_planned: number;
}

/**
 * Resumo de estoque por produto
 */
export interface ProductStockSummary {
  product_id: string;
  product_name: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  average_price: number;
  total_value: number; // current_stock * average_price
  low_stock_alert: boolean; // Se estoque está abaixo do mínimo
}

// ============================================
// FORM TYPES (para validação e criação)
// ============================================

export interface CreateProductInput {
  name: string;
  company: string;
  active_principle: string;
  unit: string;
  description?: string;
  category_ids?: string[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export interface CreateStockEntryInput {
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  entry_date: string;
  invoice_number?: string;
  notes?: string;
}

export interface CreateApplicationInput {
  name: string; // Nome da aplicação
  field_id: string;
  harvest_year_id: string;
  application_date: string;
  rate: number;
  nozzle: string;
  operator_name?: string;
  machine?: string;
  notes?: string;
  products: ApplicationProductInput[];
}

export interface ApplicationProductInput {
  product_id: string;
  dosage: number;
}

export interface CreateFieldInput {
  name: string;
  area_hectares: number;
  description?: string;
}

export interface CreateHarvestYearInput {
  name: string;
  start_date: string;
  end_date: string;
  cycles: string[]; // Array de nomes de ciclos
}

export interface CreateMachineryInput {
  name: string;
  type: 'pulverizador' | 'drone' | 'aviao';
  tank_capacity_liters: number;
  photo_url?: string;
}

export interface UpdateMachineryInput extends Partial<CreateMachineryInput> {
  id: string;
}

// ============================================
// DATABASE TYPES (Supabase)
// ============================================

/**
 * Tipos para queries do Supabase
 */
export type Database = {
  public: {
    Tables: {
      harvest_years: {
        Row: HarvestYear;
        Insert: Omit<HarvestYear, 'id' | 'created_at'>;
        Update: Partial<Omit<HarvestYear, 'id' | 'created_at'>>;
      };
      harvest_cycles: {
        Row: HarvestCycle;
        Insert: Omit<HarvestCycle, 'id' | 'created_at'>;
        Update: Partial<Omit<HarvestCycle, 'id' | 'created_at'>>;
      };
      field_crops: {
        Row: FieldCrop;
        Insert: Omit<FieldCrop, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FieldCrop, 'id' | 'created_at' | 'updated_at'>>;
      };
      fields: {
        Row: Field;
        Insert: Omit<Field, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Field, 'id' | 'created_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at'>>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>;
      };
      stock_entries: {
        Row: StockEntry;
        Insert: Omit<StockEntry, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<StockEntry, 'id' | 'created_at'>>;
      };
      applications: {
        Row: Application;
        Insert: Omit<Application, 'id' | 'created_at' | 'updated_at' | 'application_products'>;
        Update: Partial<Omit<Application, 'id' | 'created_at' | 'application_products'>>;
      };
      application_products: {
        Row: ApplicationProduct;
        Insert: Omit<ApplicationProduct, 'id' | 'created_at'>;
        Update: Partial<Omit<ApplicationProduct, 'id' | 'created_at'>>;
      };
      stock_movements: {
        Row: StockMovement;
        Insert: Omit<StockMovement, 'id' | 'created_at'>;
        Update: Partial<Omit<StockMovement, 'id' | 'created_at'>>;
      };
    };
  };
};

