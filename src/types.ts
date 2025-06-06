
export interface Ingredient {
  id: string;
  name: string;
  calories100g: number | string;
  protein100g: number | string;
  fat100g: number | string;
  carbs100g: number | string;
  grams: number | string;
  source?: 'USDA' | 'OpenFoodFacts';
  isNew?: boolean;
  isRemoving?: boolean;
}

// MealTemplate is stored in the Meal Library
export interface MealTemplate {
  id: string; // Unique ID for the meal template
  name: string;
  ingredients: Ingredient[];
  createdAt: number; // Timestamp of template creation/last update
}

// MealInstance is a specific occurrence of a meal on a given day
export interface MealInstance {
  id: string; // Unique ID for this instance of the meal
  templateId?: string; // Optional: ID of the MealTemplate it was created from
  name: string; // Can be customized from the template name
  ingredients: Ingredient[];
  createdAt: number; // Timestamp of instance creation
  // Add meal-specific notes or serving adjustments for this instance if needed in future
  // e.g., servingMultiplier?: number;
}


export interface NutrientTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// Represents an entry in a DayPlan, linking to a MealInstance
export interface MealAssignment {
  instanceId: string; // ID of the MealInstance
  mealName: string;   // Denormalized name for quick display in calendar. MUST be updated if instance name changes.
  // mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // Future enhancement
}

export interface DayPlan {
  date: string; // YYYY-MM-DD format
  mealAssignments: MealAssignment[];
  // Future: dailyNotes?: string;
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
  id: string; // ingredient name + source (if available) can make this unique for aggregation
  ingredientName: string;
  quantity: number; // Store as number for easier aggregation
  unit: string; // e.g., "g", "ml", "unit"
  mealNames: string[]; // Array of meal instance names this ingredient is for in the current week
  checked: boolean;
  source?: Ingredient['source'];
}
