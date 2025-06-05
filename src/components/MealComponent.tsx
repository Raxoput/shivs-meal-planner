import React, { useState, useCallback } from 'react';
import { Meal, Ingredient, UsdaFoodItem, OpenFoodFactsItem, SearchResultItem } from '@/types';
import { round, parseServingSize, USDA_API_KEY } from '@/constants';
import { searchUsdaFoods, searchOpenFoodFacts } from '@/services/foodSearchService';
import IngredientRowComponent from './IngredientRowComponent'; // Relative path to sibling component
import { PlusCircle, Trash2, Edit3, CheckSquare, XSquare, Copy, Search, Loader2, AlertCircle, Leaf } from './icons'; // Relative path to sibling component

interface MealComponentProps {
  meal: Meal;
  onDuplicateMeal: (mealId: string) => void;
  onRemoveMeal: (mealId: string) => void;
  onUpdateMealName: (mealId: string, newName: string) => void;
  onAddIngredient: (mealId: string, ingredientData: Partial<Ingredient>) => void;
  onRemoveIngredient: (mealId: string, ingredientId: string) => void;
  onUpdateIngredient: (mealId: string, ingredientId: string, updatedValues: Partial<Ingredient>) => void;
}

const MealComponent: React.FC<MealComponentProps> = ({
  meal, onDuplicateMeal, onRemoveMeal, onUpdateMealName,
  onAddIngredient, onRemoveIngredient, onUpdateIngredient
}) => {
  const [mealName, setMealName] = useState(meal.name);
  const [isEditingName, setIsEditingName] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAustraliaOnly, setSearchAustraliaOnly] = useState(true);
  const [searchGenericOnly, setSearchGenericOnly] = useState(false);

  const mealTotals = meal.ingredients.reduce((acc, ing) => {
    const grams = parseFloat(String(ing.grams)) || 0;
    acc.calories += (parseFloat(String(ing.calories100g)) || 0) / 100 * grams;
    acc.protein += (parseFloat(String(ing.protein100g)) || 0) / 100 * grams;
    acc.fat += (parseFloat(String(ing.fat100g)) || 0) / 100 * grams;
    acc.carbs += (parseFloat(String(ing.carbs100g)) || 0) / 100 * grams;
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMealName(e.target.value);
  };

  const saveMealName = () => {
    if (mealName.trim() === "") {
      setMealName(meal.name);
    } else {
      onUpdateMealName(meal.id, mealName.trim());
    }
    setIsEditingName(false);
  };

  const cancelEditMealName = () => {
    setMealName(meal.name);
    setIsEditingName(false);
  };

  const handleFoodSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a food item to search.");
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      let results: SearchResultItem[] = [];
      if (searchGenericOnly) {
        results = await searchUsdaFoods(searchQuery);
        if (results.length === 0) {
          setSearchError(`No generic products found for "${searchQuery}" via USDA. Try different terms.`);
        }
      } else {
        results = await searchOpenFoodFacts(searchQuery, searchAustraliaOnly);
         if (results.length === 0) {
          setSearchError(`No products found for "${searchQuery}" ${searchAustraliaOnly ? 'in Australia (OpenFoodFacts)' : '(OpenFoodFacts)'}. Try a broader search or different terms.`);
        }
      }
      setSearchResults(results);
    } catch (error: any) {
      console.error("Error searching food:", error);
      setSearchError(`Failed to fetch data: ${error.message}.`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchGenericOnly, searchAustraliaOnly]);

  const handleAddFoodFromSearch = (item: SearchResultItem) => {
    let newIngredient: Partial<Ingredient>;

    if (item.source === 'USDA') {
      const usdaItem = item as UsdaFoodItem;
      const findNutrient = (id: number) => usdaItem.foodNutrients.find(n => n.nutrientId === id || n.nutrientNumber === String(id));
      const caloriesNutrient = findNutrient(1008) || findNutrient(2047); // 1008: Energy kcal, 2047: Energy (older datasets, might be kJ)
      const proteinNutrient = findNutrient(1003);
      const fatNutrient = findNutrient(1004);
      const carbsNutrient = findNutrient(1005);

      newIngredient = {
        name: usdaItem.description || 'Unknown USDA Product',
        calories100g: round(caloriesNutrient?.value || 0), // USDA is per 100g
        protein100g: round(proteinNutrient?.value || 0),
        fat100g: round(fatNutrient?.value || 0),
        carbs100g: round(carbsNutrient?.value || 0),
        grams: 0, // Default to 0 for USDA items
        source: 'USDA',
      };
    } else { // OpenFoodFacts
      const offItem = item as OpenFoodFactsItem;
      const nutriments = offItem.nutriments || {};
      const productName = offItem.product_name_en || offItem.product_name || offItem.generic_name_en || offItem.generic_name || 'Unknown Product';
      
      let calories = parseFloat(String(nutriments['energy-kcal_100g']));
      if (isNaN(calories) && nutriments.energy_100g) { // if kcal not available, try energy_100g (might be kJ)
          const energyKj = parseFloat(String(nutriments.energy_100g));
          if (!isNaN(energyKj)) calories = energyKj / 4.184; // Convert kJ to kcal
      }

      newIngredient = {
        name: productName + (offItem.brands ? ` (${offItem.brands})` : ''),
        calories100g: round(calories || 0),
        protein100g: round(parseFloat(String(nutriments.proteins_100g)) || 0),
        fat100g: round(parseFloat(String(nutriments.fat_100g)) || 0),
        carbs100g: round(parseFloat(String(nutriments.carbohydrates_100g)) || 0),
        grams: parseServingSize(offItem.serving_size) || 100,
        source: 'OpenFoodFacts',
      };
    }
    onAddIngredient(meal.id, newIngredient);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };
  
  const handleGenericSearchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchGenericOnly(e.target.checked);
    // Reset search results and error when changing search type
    setSearchResults([]);
    setSearchError(null);
  };

  return (
    <section className="mb-10 p-4 md:p-6 bg-slate-800 rounded-xl shadow-xl border border-slate-700">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-grow">
            <input
              type="text" value={mealName} onChange={handleNameChange}
              onBlur={saveMealName} onKeyPress={(e) => e.key === 'Enter' && saveMealName()}
              className="bg-slate-700 text-slate-100 p-2 rounded-md text-2xl font-semibold border border-sky-500 focus:ring-2 focus:ring-sky-500 outline-none flex-grow"
              autoFocus
            />
            <button onClick={saveMealName} className="p-2 text-green-400 hover:text-green-300" aria-label="Save meal name"><CheckSquare size={24}/></button>
            <button onClick={cancelEditMealName} className="p-2 text-red-400 hover:text-red-300" aria-label="Cancel editing meal name"><XSquare size={24}/></button>
          </div>
        ) : (
          <div className="flex items-center flex-grow min-w-0"> {/* Added min-w-0 for flex child truncation */}
            <h2 className="text-2xl font-semibold text-sky-400 mr-3 truncate" onClick={() => setIsEditingName(true)} title={meal.name}>{meal.name}</h2>
            <button onClick={() => setIsEditingName(true)} className="p-1 text-slate-500 hover:text-sky-400 flex-shrink-0" aria-label="Edit meal name"><Edit3 size={18} /></button>
            <button onClick={() => onDuplicateMeal(meal.id)} className="ml-2 p-1 text-slate-500 hover:text-sky-400 flex-shrink-0" aria-label="Duplicate meal"><Copy size={18} /></button>
          </div>
        )}
        <button onClick={() => onRemoveMeal(meal.id)} className="text-red-500 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-slate-700 flex-shrink-0 ml-2" aria-label="Remove meal"><Trash2 size={22} /></button>
      </div>

      <div className="my-4 p-4 bg-slate-700/50 rounded-lg">
        <h3 className="text-lg font-medium text-sky-300 mb-2">Add Ingredient via Search</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleFoodSearch()}
              className="w-full bg-slate-600 text-slate-100 p-2 rounded-md border border-slate-500 focus:ring-1 focus:ring-sky-500 outline-none"
              aria-label="Search for food item"
            />
            {!searchQuery && (
              <div 
                className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400 text-sm pointer-events-none select-none"
                aria-hidden="true" 
              >
                Use the USDA for generic items like bananas, and OpenFoodFacts for branded products.
              </div>
            )}
          </div>
          <button
            onClick={handleFoodSearch} disabled={isSearching || (searchGenericOnly && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY))}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-md shadow transition-colors duration-150 flex items-center justify-center disabled:opacity-50"
          >
            {isSearching ? <Loader2 size={20} className="animate-spin mr-2" /> : <Search size={20} className="mr-2" />}
            Search Food
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mb-3">
            <label htmlFor={`generic-filter-${meal.id}`} className="flex items-center text-sm text-slate-300 cursor-pointer">
                <input
                    type="checkbox" id={`generic-filter-${meal.id}`}
                    checked={searchGenericOnly} onChange={handleGenericSearchToggle}
                    className="mr-2 h-4 w-4 rounded bg-slate-600 border-slate-500 text-green-500 focus:ring-green-500 accent-green-500"
                />
                <Leaf size={16} className="mr-1 text-green-400"/> Search Generic Products (USDA)
            </label>
            {!searchGenericOnly && (
                <label htmlFor={`australia-filter-${meal.id}`} className="flex items-center text-sm text-slate-300 cursor-pointer">
                    <input
                        type="checkbox" id={`australia-filter-${meal.id}`}
                        checked={searchAustraliaOnly} onChange={(e) => setSearchAustraliaOnly(e.target.checked)}
                        className="mr-2 h-4 w-4 rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-500 accent-sky-500"
                    />
                    Search Australian products only (OpenFoodFacts)
                </label>
            )}
        </div>
        {searchError && <p className="text-sm text-red-400 mt-2 flex items-center"><AlertCircle size={16} className="mr-1"/> {searchError}</p>}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1"> {/* Removed custom-scrollbar, added pr-1 for consistency */}
            {searchResults.map(item => (
              <div key={(item as UsdaFoodItem).fdcId || (item as OpenFoodFactsItem).code || (item as any).id} className="p-3 bg-slate-600 rounded-md flex flex-col sm:flex-row justify-between sm:items-center text-sm gap-2">
                <div className="flex-grow min-w-0"> {/* Added min-w-0 */}
                  <p className="font-semibold text-slate-100 truncate" title={item.source === 'USDA' ? (item as UsdaFoodItem).description : ((item as OpenFoodFactsItem).product_name_en || (item as OpenFoodFactsItem).product_name || (item as OpenFoodFactsItem).generic_name_en || 'Unknown Product')}>
                    {item.source === 'USDA' ? (item as UsdaFoodItem).description : ((item as OpenFoodFactsItem).product_name_en || (item as OpenFoodFactsItem).product_name || (item as OpenFoodFactsItem).generic_name_en || 'Unknown Product')}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.source === 'USDA' ? `Source: USDA (${(item as UsdaFoodItem).dataType || ''})` : ((item as OpenFoodFactsItem).brands || 'N/A Brand')}
                    {item.source === 'OpenFoodFacts' && (item as OpenFoodFactsItem).countries_tags?.includes('en:australia') && <span className="ml-2 text-green-400 text-xs">(Australia)</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleAddFoodFromSearch(item)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs py-1.5 px-3 rounded-md transition-colors self-start sm:self-center flex-shrink-0"
                >
                  Add to Meal
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm text-left text-slate-300">
          <thead className="text-xs text-sky-300 uppercase bg-slate-700/50">
            <tr>
              <th scope="col" className="px-4 py-3 rounded-tl-lg w-2/12">Ingredient</th>
              <th scope="col" className="px-4 py-3 text-center w-1/12">Cal/100g</th>
              <th scope="col" className="px-4 py-3 text-center w-1/12">Prot/100g</th>
              <th scope="col" className="px-4 py-3 text-center w-1/12">Fat/100g</th>
              <th scope="col" className="px-4 py-3 text-center w-1/12">Carb/100g</th>
              <th scope="col" className="px-4 py-3 text-center w-1/12">Grams</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-sky-200 w-1/12">Calories</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-sky-200 w-1/12">Protein</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-sky-200 w-1/12">Fat</th>
              <th scope="col" className="px-4 py-3 text-center font-semibold text-sky-200 w-1/12">Carbs</th>
              <th scope="col" className="px-4 py-3 text-center rounded-tr-lg w-1/12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meal.ingredients.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-4 text-slate-400">No ingredients added yet. Use search or "Add Manually" button.</td>
              </tr>
            )}
            {meal.ingredients.map(ingredient => (
              <IngredientRowComponent
                key={ingredient.id}
                ingredient={ingredient}
                onUpdate={(updatedValues) => onUpdateIngredient(meal.id, ingredient.id, updatedValues)}
                onRemove={() => onRemoveIngredient(meal.id, ingredient.id)}
              />
            ))}
            {meal.ingredients.length > 0 && (
              <tr className="font-semibold bg-slate-700/80 text-sky-100">
                <td className="px-4 py-3 rounded-bl-lg">Total</td>
                <td className="px-4 py-3 text-center" colSpan={5}></td>
                <td className="px-4 py-3 text-center">{round(mealTotals.calories)}</td>
                <td className="px-4 py-3 text-center">{round(mealTotals.protein)}</td>
                <td className="px-4 py-3 text-center">{round(mealTotals.fat)}</td>
                <td className="px-4 py-3 text-center">{round(mealTotals.carbs)}</td>
                <td className="px-4 py-3 text-center rounded-br-lg"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <button
          onClick={() => onAddIngredient(meal.id, { name: 'New Ingredient', grams: 100 })}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-md shadow transition-colors duration-150 flex items-center text-sm"
        >
          <PlusCircle size={18} className="mr-2" /> Add Ingredient Manually
        </button>
      </div>
    </section>
  );
}

export default MealComponent;
