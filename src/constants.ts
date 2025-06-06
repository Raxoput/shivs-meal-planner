
export const USDA_API_KEY: string = 'SV7CMpXdfiKv01UstdMZnoOeohXgdrkrw2Y3zDnB'; // USDA API Key

export const generateId = (): string => crypto.randomUUID();

export const round = (value: number | string | null | undefined, decimals: number = 2): number => {
  if (value === null || value === undefined || value === '' || isNaN(parseFloat(String(value)))) return 0;
  // The expression parseFloat(String(value)) + 'e' + decimals correctly creates a string like "123.45e2".
  // Math.round expects a number, so we explicitly convert this string to a number.
  // The rest of the expression Number( ... + 'e-' + decimals) is a common JS trick for rounding.
  return Number(Math.round(Number(parseFloat(String(value)) + 'e' + decimals)) + 'e-' + decimals);
};

export const parseServingSize = (servingString?: string): number | null => {
  if (!servingString || typeof servingString !== 'string') return null;
  const match = servingString.match(/(\d+(\.\d+)?)\s*g/i); 
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
};

export const DEFAULT_INITIAL_MEALS = [ // This now defines default MealTemplates
  {
    id: generateId(),
    name: 'My First Meal Template',
    ingredients: [],
    createdAt: Date.now()
    // isDetailsExpanded is no longer part of MealTemplate
  }
];
