export interface Ingredient {
  id: string;
  name: string;
  calories100g: number | string; 
  protein100g: number | string;
  fat100g: number | string;
  carbs100g: number | string;
  grams: number | string;
  source?: 'USDA' | 'OpenFoodFacts'; // Removed 'AI (Estimate)'
  isNew?: boolean; 
  isRemoving?: boolean; 
}

export interface Meal {
  id: string;
  name: string;
  ingredients: Ingredient[];
  createdAt: number; 
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
  source?: 'USDA'; 
}

// For Open Food Facts API responses
export interface OpenFoodFactsNutriments {
  'energy-kcal_100g'?: number | string;
  energy_100g?: number | string; 
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
  source?: 'OpenFoodFacts';
}

export type SearchResultItem = UsdaFoodItem | OpenFoodFactsItem;

// For Shopping List
export interface ShoppingListItem {
  id: string;
  ingredientName: string;
  quantity: string; // e.g., "250g" or "1 unit"
  mealNames: string; // Comma-separated list of meal names
  checked: boolean;
  source?: Ingredient['source']; // To show source icon in shopping list
}
