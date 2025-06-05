export interface Ingredient {
  id: string;
  name: string;
  calories100g: number | string; // string to allow empty input
  protein100g: number | string;
  fat100g: number | string;
  carbs100g: number | string;
  grams: number | string;
  source?: 'USDA' | 'OpenFoodFacts'; // Optional: to track where it came from
}

export interface Meal {
  id: string;
  name: string;
  ingredients: Ingredient[];
  createdAt: number; // Store as timestamp (Date.now())
}

export interface NutrientTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// For USDA API responses
export interface UsdaFoodNutrient {
  nutrientId: number;
  nutrientNumber?: string; 
  nutrientName: string;
  value: number;
  unitName: string;
}

export interface UsdaFoodItem {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients: UsdaFoodNutrient[];
  source?: 'USDA'; // To distinguish from OpenFoodFactsItem
}

// For Open Food Facts API responses
export interface OpenFoodFactsNutriments {
  'energy-kcal_100g'?: number | string;
  energy_100g?: number | string; // Sometimes energy is in kJ
  proteins_100g?: number | string;
  fat_100g?: number | string;
  carbohydrates_100g?: number | string;
}

export interface OpenFoodFactsItem {
  code: string;
  product_name_en?: string;
  product_name?: string;
  generic_name_en?: string;
  generic_name?: string;
  brands?: string;
  nutriments: OpenFoodFactsNutriments;
  serving_size?: string;
  countries_tags?: string[];
  source?: 'OpenFoodFacts'; // To distinguish from UsdaFoodItem
}

export type SearchResultItem = UsdaFoodItem | OpenFoodFactsItem;
