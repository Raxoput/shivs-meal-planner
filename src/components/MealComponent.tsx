
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Meal, Ingredient, UsdaFoodItem, OpenFoodFactsItem, SearchResultItem, NutrientTotals, UsdaFoodNutrient } from '../types';
import { round, parseServingSize, USDA_API_KEY } from '../constants';
import { searchUsdaFoods, searchOpenFoodFacts } from '../services/foodSearchService';
import IngredientRowComponent from './IngredientRowComponent';
import DonutChart from './DonutChart';
import { PlusCircle, Trash2, Edit3, CheckSquare, XSquare, Copy, Search, Loader2, AlertCircle, Leaf, ChevronDown, Database, ShoppingBasket } from './icons'; // Removed ChevronUp

interface MealComponentProps {
  meal: Meal;
  onDuplicateMeal: (mealId: string) => void;
  onRemoveMeal: (mealId: string) => void;
  onUpdateMealName: (mealId: string, newName: string) => void;
  onAddIngredient: (mealId: string, ingredientData?: Partial<Ingredient>) => void;
  onRemoveIngredient: (mealId: string, ingredientId: string) => void;
  onUpdateIngredient: (mealId: string, ingredientId: string, updatedValues: Partial<Ingredient>) => void;
}

const MealComponent: React.FC<MealComponentProps> = ({
  meal, onDuplicateMeal, onRemoveMeal, onUpdateMealName,
  onAddIngredient, onRemoveIngredient, onUpdateIngredient
}) => {
  const [mealName, setMealName] = useState(meal.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const mealNameInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAustraliaOnly, setSearchAustraliaOnly] = useState(true);
  const [searchGenericOnly, setSearchGenericOnly] = useState(false);
  const [isSearchSectionVisible, setIsSearchSectionVisible] = useState(false);

  useEffect(() => {
    if (isEditingName && mealNameInputRef.current) {
      mealNameInputRef.current.focus();
      mealNameInputRef.current.select();
    }
  }, [isEditingName]);

  const mealTotals = meal.ingredients.reduce((acc: NutrientTotals, ing: Ingredient) => {
    if (ing.isRemoving) return acc;
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
    const trimmedName = mealName.trim();
    if (trimmedName === "") {
      setMealName(meal.name);
    } else if (trimmedName !== meal.name) {
      onUpdateMealName(meal.id, trimmedName);
    }
    setIsEditingName(false);
  };

  const cancelEditMealName = () => {
    setMealName(meal.name);
    setIsEditingName(false);
  };

  useEffect(() => {
    setMealName(meal.name);
  }, [meal.name]);

  const handleFoodSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a food item to search.");
      setSearchResults([]);
      return;
    }
     if (searchGenericOnly && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY)) {
      setSearchError("USDA API Key is missing. Please add it in constants.ts to search generic products. You can obtain one from api.nal.usda.gov.");
      setIsSearching(false);
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
          setSearchError(`No generic products found for "${searchQuery}" via USDA. Try different terms or uncheck "Generic Products".`);
        }
      } else {
        results = await searchOpenFoodFacts(searchQuery, searchAustraliaOnly);
        if (results.length === 0) {
          setSearchError(`No products found for "${searchQuery}" ${searchAustraliaOnly ? 'in Australia (OpenFoodFacts)' : '(OpenFoodFacts)'}. Try a broader search, different terms, or check "Generic Products".`);
        }
      }
      setSearchResults(results);
    } catch (error: any) {
      console.error("Error searching food:", error);
      setSearchError(`Failed to fetch data: ${error.message}. Please check your connection or API key setup.`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchGenericOnly, searchAustraliaOnly]);

  const handleAddFoodFromSearch = (item: SearchResultItem) => {
    let newIngredientData: Partial<Ingredient>;
    if (item.source === 'USDA') {
      const usdaItem = item as UsdaFoodItem;
      const findNutrient = (id: number, altId?: string) => usdaItem.foodNutrients.find((n: UsdaFoodNutrient) => n.nutrientId === id || (altId && n.nutrientNumber === altId));
      const caloriesNutrient = findNutrient(1008, '208') || findNutrient(2047);
      const proteinNutrient = findNutrient(1003, '203');
      const fatNutrient = findNutrient(1004, '204');
      const carbsNutrient = findNutrient(1005, '205');
      newIngredientData = {
        name: usdaItem.description || 'Unknown USDA Product',
        calories100g: round(caloriesNutrient?.value || 0),
        protein100g: round(proteinNutrient?.value || 0),
        fat100g: round(fatNutrient?.value || 0),
        carbs100g: round(carbsNutrient?.value || 0),
        grams: 100,
        source: 'USDA',
      };
    } else {
      const offItem = item as OpenFoodFactsItem;
      const nutriments = offItem.nutriments || {};
      const productName = offItem.product_name_en || offItem.product_name || offItem.generic_name_en || offItem.generic_name || 'Unknown Product';

      let calories = parseFloat(String(nutriments['energy-kcal_100g']));
      if (isNaN(calories) && nutriments.energy_100g) {
          const energyKj = parseFloat(String(nutriments.energy_100g));
          if (!isNaN(energyKj)) calories = energyKj / 4.184;
      }

      newIngredientData = {
        name: productName + (offItem.brands ? ` - ${offItem.brands}` : ''),
        calories100g: round(calories || 0),
        protein100g: round(parseFloat(String(nutriments.proteins_100g)) || 0),
        fat100g: round(parseFloat(String(nutriments.fat_100g)) || 0),
        carbs100g: round(parseFloat(String(nutriments.carbohydrates_100g)) || 0),
        grams: parseServingSize(offItem.serving_size) || 100,
        source: 'OpenFoodFacts',
      };
    }
    onAddIngredient(meal.id, newIngredientData);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handleGenericSearchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchGenericOnly(e.target.checked);
    setSearchResults([]);
    setSearchError(null);
    if (e.target.checked && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY)) {
         setSearchError("Note: USDA API Key is missing. Generic search will not work until it's added in constants.ts.");
    }
  };

  const handleAustraliaOnlyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchAustraliaOnly(e.target.checked);
    setSearchResults([]);
    setSearchError(null);
  };

  const getMealAuraClass = () => {
    const calories = mealTotals.calories;
    if (calories < 300) return 'meal-aura-low';
    if (calories <= 700) return 'meal-aura-medium';
    return 'meal-aura-high';
  };

  return (
    <section className={`bg-slate-800/80 backdrop-blur-md rounded-xl shadow-xl shadow-slate-900/50 border border-slate-700/60 overflow-hidden meal-aura ${getMealAuraClass()}`}>
      <div className="p-4 sm:p-6 border-b border-slate-700/60 flex justify-between items-start gap-3 sm:gap-4">
        <div className="flex-grow min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            {isEditingName ? (
                <div className="flex items-center gap-2 flex-grow w-full sm:w-auto min-w-0">
                <input
                    ref={mealNameInputRef}
                    type="text" value={mealName} onChange={handleNameChange}
                    onBlur={saveMealName}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') saveMealName();
                        if (e.key === 'Escape') cancelEditMealName();
                    }}
                    className="font-heading bg-slate-700 text-slate-100 p-2 rounded-md text-xl sm:text-2xl font-semibold border-2 border-teal-500 focus:ring-2 focus:ring-teal-500/80 outline-none flex-grow min-w-0"
                    aria-label="Edit meal name input"
                />
                <button onClick={saveMealName} className="p-2 text-green-400 hover:text-green-300 transition-colors flex-shrink-0" aria-label="Save meal name"><CheckSquare size={22}/></button>
                <button onClick={cancelEditMealName} className="p-2 text-red-400 hover:text-red-300 transition-colors flex-shrink-0" aria-label="Cancel editing meal name"><XSquare size={22}/></button>
                </div>
            ) : (
                <div className="flex items-center flex-grow min-w-0">
                <h2
                    className="font-heading text-xl sm:text-2xl font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer truncate"
                    onClick={() => setIsEditingName(true)}
                    title={`Edit meal name: ${meal.name}`}
                    aria-label={`Meal name: ${meal.name}. Click to edit.`}
                >
                    {meal.name}
                </h2>
                <button onClick={() => setIsEditingName(true)} className="ml-2 p-1 text-slate-400 hover:text-teal-400 transition-colors flex-shrink-0" aria-label="Edit meal name"><Edit3 size={18} /></button>
                </div>
            )}
            <div className="flex items-center flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0">
                <button onClick={() => onDuplicateMeal(meal.id)} className="p-2 text-slate-400 hover:text-purple-400 transition-colors rounded-md hover:bg-slate-700/50" aria-label="Duplicate meal"><Copy size={20} /></button>
                <button onClick={() => onRemoveMeal(meal.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-md hover:bg-slate-700/50" aria-label="Remove meal"><Trash2 size={20} /></button>
            </div>
            </div>
        </div>
        <div className="ml-auto flex-shrink-0 pt-1">
            <DonutChart
                protein={round(mealTotals.protein)}
                carbs={round(mealTotals.carbs)}
                fat={round(mealTotals.fat)}
                totalCalories={round(mealTotals.calories)}
                size={100}
                strokeWidth={14}
            />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <button
          onClick={() => setIsSearchSectionVisible(!isSearchSectionVisible)}
          className="w-full flex items-center justify-between text-left p-3.5 bg-slate-700/70 hover:bg-slate-700 rounded-lg mb-4 transition-all duration-200 ease-in-out group focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 outline-none"
          aria-expanded={isSearchSectionVisible}
          aria-controls={`search-section-${meal.id}`}
        >
          <span className="font-medium text-slate-100 group-hover:text-white font-heading">
            <Search size={18} className="inline mr-2 align-text-bottom"/> Add Ingredient via Search
          </span>
          <ChevronDown size={20} className={`transition-transform duration-300 ${isSearchSectionVisible ? 'rotate-180' : ''}`} />
        </button>

        <div
          id={`search-section-${meal.id}`}
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isSearchSectionVisible ? 'max-h-[600px] opacity-100 mt-4 mb-4' : 'max-h-0 opacity-0'}`}
          role="region"
          aria-hidden={!isSearchSectionVisible}
        >
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/70">
            <div className="flex flex-col sm:flex-row gap-3 mb-3 items-stretch">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFoodSearch()}
                  className="w-full bg-slate-600/90 text-slate-100 p-3 rounded-md border border-slate-500/80 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none placeholder-slate-400"
                  placeholder="e.g., 'banana' or 'pasta sauce'"
                  aria-label="Search for food item to add"
                />
              </div>
              <button
                onClick={handleFoodSearch} disabled={isSearching || !searchQuery.trim() || (searchGenericOnly && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY))}
                className="bg-gradient-to-r from-teal-500 to-sky-600 hover:from-teal-600 hover:to-sky-700 text-white font-medium py-3 px-5 rounded-md shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                aria-live="polite"
              >
                {isSearching ? <Loader2 size={20} className="animate-spin mr-2" /> : <Search size={20} className="mr-2" />}
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 mb-4 text-sm">
                <label htmlFor={`generic-filter-${meal.id}`} className="flex items-center text-slate-300 hover:text-slate-100 cursor-pointer transition-colors">
                    <input
                        type="checkbox" id={`generic-filter-${meal.id}`}
                        checked={searchGenericOnly} onChange={handleGenericSearchToggle}
                        className="mr-2 h-4 w-4 rounded bg-slate-500 border-slate-400 text-green-500 focus:ring-green-500 accent-green-500 cursor-pointer"
                    />
                    <Database size={16} className="mr-1.5 text-green-400"/> Search Generic Foods (USDA)
                </label>
                {!searchGenericOnly && (
                    <label htmlFor={`australia-filter-${meal.id}`} className="flex items-center text-slate-300 hover:text-slate-100 cursor-pointer transition-colors">
                        <input
                            type="checkbox" id={`australia-filter-${meal.id}`}
                            checked={searchAustraliaOnly} onChange={handleAustraliaOnlyToggle}
                            className="mr-2 h-4 w-4 rounded bg-slate-500 border-slate-400 text-sky-500 focus:ring-sky-500 accent-sky-500 cursor-pointer"
                        />
                       <ShoppingBasket size={16} className="mr-1.5 text-sky-400" /> Australian Products Only (OpenFoodFacts)
                    </label>
                )}
            </div>
            {searchError && <p className="text-sm text-red-400 my-2 p-3 bg-red-900/40 border border-red-700/60 rounded-md flex items-center" role="alert"><AlertCircle size={18} className="mr-2 flex-shrink-0"/> {searchError}</p>}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar" aria-live="polite">
                {searchResults.map(item => {
                  const itemId = (item as UsdaFoodItem).fdcId || (item as OpenFoodFactsItem).code || Math.random().toString();
                  const itemName = item.source === 'USDA' ? (item as UsdaFoodItem).description : ((item as OpenFoodFactsItem).product_name_en || (item as OpenFoodFactsItem).product_name || (item as OpenFoodFactsItem).generic_name_en || (item as OpenFoodFactsItem).generic_name || 'Unknown Product');
                  const itemBrand = item.source === 'USDA' ? `Source: USDA (${(item as UsdaFoodItem).dataType || 'N/A'})` : ((item as OpenFoodFactsItem).brands || 'N/A Brand');
                  const isAustralian = item.source === 'OpenFoodFacts' && (item as OpenFoodFactsItem).countries_tags?.includes('en:australia');

                  return (
                    <div key={itemId} className="p-3 bg-slate-600/80 hover:bg-slate-600 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center text-sm gap-3 transition-all duration-150 transform hover:scale-[1.01]">
                      <div className="flex-grow min-w-0 flex items-center">
                        {item.source === 'USDA' ?
                            <span title="USDA Generic Food" className="mr-2.5 flex-shrink-0">
                                <Database size={18} className="text-green-400" />
                            </span> :
                            <span title="OpenFoodFacts Product" className="mr-2.5 flex-shrink-0">
                                <ShoppingBasket size={18} className="text-sky-400" />
                            </span>
                        }
                        <div>
                            <p className="font-semibold text-slate-100 truncate" title={itemName}>{itemName}</p>
                            <p className="text-xs text-slate-400 truncate" title={itemBrand}>
                            {itemBrand}
                            {isAustralian && <span className="ml-2 text-green-400 text-xs font-medium">(AU)</span>}
                            </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddFoodFromSearch(item)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-3.5 rounded-md shadow hover:shadow-md transition-all duration-150 self-start sm:self-center flex-shrink-0"
                        aria-label={`Add ${itemName} to meal`}
                      >
                        <PlusCircle size={14} className="inline mr-1.5 align-text-bottom"/> Add to Meal
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-700/60 shadow-inner bg-slate-800/50">
          <table className="w-full min-w-[1000px] text-sm text-left text-slate-300">
            <caption className="sr-only">Ingredients for {meal.name}</caption>
            <thead className="text-xs text-teal-300/90 uppercase bg-slate-700/80 font-heading tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5 w-3/12">Ingredient</th>
                <th scope="col" className="px-3 py-3.5 text-center w-[7%]">Cal/100g</th>
                <th scope="col" className="px-3 py-3.5 text-center w-[7%]">Prot/100g</th>
                <th scope="col" className="px-3 py-3.5 text-center w-[7%]">Fat/100g</th>
                <th scope="col" className="px-3 py-3.5 text-center w-[7%]">Carb/100g</th>
                <th scope="col" className="px-3 py-3.5 text-center w-[8%]">Grams</th>
                <th scope="col" className="px-3 py-3.5 text-center font-semibold text-teal-200 w-[8%]">Calories</th>
                <th scope="col" className="px-3 py-3.5 text-center font-semibold text-teal-200 w-[7%]">Protein</th>
                <th scope="col" className="px-3 py-3.5 text-center font-semibold text-teal-200 w-[7%]">Fat</th>
                <th scope="col" className="px-3 py-3.5 text-center font-semibold text-teal-200 w-[7%]">Carbs</th>
                <th scope="col" className="px-3 py-3.5 text-center w-1/12 sm:w-[5%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {(meal.ingredients.filter(ing => !ing.isRemoving) || []).length === 0 ? (
                 <tr>
                    <td colSpan={11} className="text-center py-10 px-4 text-slate-400">
                        <Leaf size={28} className="inline-block mr-2 mb-1 opacity-70 text-slate-500" />
                        <p className="font-medium">No ingredients in this meal yet.</p>
                        <p className="text-sm">Use search above or "Add Ingredient Manually" below.</p>
                    </td>
                </tr>
              ) : (
                meal.ingredients.map(ingredient => (
                  <IngredientRowComponent
                    key={ingredient.id}
                    ingredient={ingredient}
                    onUpdate={(updatedValues) => onUpdateIngredient(meal.id, ingredient.id, updatedValues)}
                    onRemove={() => onRemoveIngredient(meal.id, ingredient.id)}
                  />
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-700/50 border-t-2 border-slate-600/80">
                <tr>
                    <th scope="row" className="px-4 py-3.5 text-right font-semibold text-slate-100 uppercase tracking-wider text-xs" colSpan={6}>Meal Totals:</th>
                    <td className="px-3 py-3.5 text-center font-bold text-teal-300">{round(mealTotals.calories)}</td>
                    <td className="px-3 py-3.5 text-center font-bold text-teal-300">{round(mealTotals.protein)}</td>
                    <td className="px-3 py-3.5 text-center font-bold text-teal-300">{round(mealTotals.fat)}</td>
                    <td className="px-3 py-3.5 text-center font-bold text-teal-300">{round(mealTotals.carbs)}</td>
                    <td className="px-4 py-3.5"></td> {/* Empty cell for actions column */}
                </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-6 flex justify-start">
          <button
            onClick={() => onAddIngredient(meal.id)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center group focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 outline-none"
            aria-label="Add a blank ingredient manually to this meal"
          >
            <PlusCircle size={20} className="mr-2 group-hover:animate-pulse-gentle-hover" /> Add Ingredient Manually
          </button>
        </div>
      </div>
    </section>
  );
};

export default MealComponent;
