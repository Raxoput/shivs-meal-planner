
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MealTemplate, MealInstance, Ingredient, UsdaFoodItem, OpenFoodFactsItem, SearchResultItem, NutrientTotals, UsdaFoodNutrient } from '../types';
import { round, parseServingSize, USDA_API_KEY, generateId } from '../constants';
import { searchUsdaFoods, searchOpenFoodFacts } from '../services/foodSearchService';
import IngredientRowComponent from './IngredientRowComponent';
import DonutChart from './DonutChart';
import { PlusCircle, Trash2, Edit3, CheckSquare, XSquare, Search, Loader2, AlertCircle, Leaf, Database, ShoppingBasket, Save, Copy, Star } from './icons';

interface MealComponentProps {
  mealData: MealTemplate | MealInstance;
  editingMode: 'template' | 'instance';
  onUpdateMealData: (updatedData: Partial<MealTemplate | MealInstance>) => void;
  onSave: (dataToSave: MealTemplate | MealInstance) => void;
  onClose: () => void;
  onSaveAsTemplate?: (instanceData: MealInstance) => void; // Only for instance mode
}

const MealComponent: React.FC<MealComponentProps> = ({
  mealData, editingMode, onUpdateMealData, onSave, onClose, onSaveAsTemplate
}) => {
  const [currentMeal, setCurrentMeal] = useState<MealTemplate | MealInstance>(mealData);
  const [isEditingName, setIsEditingName] = useState(false);
  const mealNameInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAustraliaOnly, setSearchAustraliaOnly] = useState(true);
  const [searchGenericOnly, setSearchGenericOnly] = useState(false);

  useEffect(() => {
    setCurrentMeal(mealData);
    // Reset search when mealData changes
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, [mealData]);

  useEffect(() => {
    if (isEditingName && mealNameInputRef.current) {
      mealNameInputRef.current.focus();
      mealNameInputRef.current.select();
    }
  }, [isEditingName]);

  const mealTotals = currentMeal.ingredients.reduce((acc: NutrientTotals, ing: Ingredient) => {
    const grams = parseFloat(String(ing.grams)) || 0;
    acc.calories += (parseFloat(String(ing.calories100g)) || 0) / 100 * grams;
    acc.protein += (parseFloat(String(ing.protein100g)) || 0) / 100 * grams;
    acc.fat += (parseFloat(String(ing.fat100g)) || 0) / 100 * grams;
    acc.carbs += (parseFloat(String(ing.carbs100g)) || 0) / 100 * grams;
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentMeal(prev => ({ ...prev, name: e.target.value }));
  };

  const saveCurrentMealName = () => {
    const trimmedName = currentMeal.name.trim();
    if (trimmedName === "") {
      setCurrentMeal(prev => ({ ...prev, name: mealData.name })); // Revert if empty
      onUpdateMealData({ name: mealData.name });
    } else if (trimmedName !== mealData.name) {
      onUpdateMealData({ name: trimmedName }); // Propagate change to parent for its state
    }
    setIsEditingName(false);
  };
  
  const cancelEditCurrentMealName = () => {
    setCurrentMeal(prev => ({ ...prev, name: mealData.name })); // Revert to original prop name
    onUpdateMealData({ name: mealData.name });
    setIsEditingName(false);
  };

  const handleAddIngredient = (ingredientData?: Partial<Ingredient>) => {
    const newIngredient: Ingredient = {
      id: generateId(),
      name: '', calories100g: 0, protein100g: 0, fat100g: 0, carbs100g: 0, grams: 0,
      ...ingredientData,
      isNew: true,
    };
    const updatedIngredients = [...currentMeal.ingredients, newIngredient];
    setCurrentMeal(prev => ({ ...prev, ingredients: updatedIngredients }));
    onUpdateMealData({ ingredients: updatedIngredients });
  };

  const handleRemoveIngredient = (ingredientId: string) => {
    const updatedIngredients = currentMeal.ingredients.filter(ing => ing.id !== ingredientId);
    setCurrentMeal(prev => ({ ...prev, ingredients: updatedIngredients }));
    onUpdateMealData({ ingredients: updatedIngredients });
  };

  const handleUpdateIngredient = (ingredientId: string, updatedValues: Partial<Ingredient>) => {
    const updatedIngredients = currentMeal.ingredients.map(ing => ing.id === ingredientId ? { ...ing, ...updatedValues, isNew: false } : ing);
    setCurrentMeal(prev => ({ ...prev, ingredients: updatedIngredients }));
    onUpdateMealData({ ingredients: updatedIngredients });
  };

  const handleFoodSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a food item to search.");
      setSearchResults([]);
      return;
    }
    if (searchGenericOnly && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY)) {
      setSearchError("USDA API Key is missing. Generic search disabled.");
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
      } else {
        results = await searchOpenFoodFacts(searchQuery, searchAustraliaOnly);
      }
      setSearchResults(results);
      if (results.length === 0) {
          setSearchError(`No results for "${searchQuery}". Try different terms or filters.`);
      }
    } catch (error: any) {
      setSearchError(`Search failed: ${error.message}.`);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchGenericOnly, searchAustraliaOnly]);

  const handleAddFoodFromSearch = (item: SearchResultItem) => {
    let newIngredientData: Partial<Ingredient>;
    if (item.source === 'USDA') {
      const usdaItem = item as UsdaFoodItem;
      const findNutrient = (id: number, altId?: string) => usdaItem.foodNutrients.find((n: UsdaFoodNutrient) => n.nutrientId === id || (altId && n.nutrientNumber === altId));
      newIngredientData = {
        name: usdaItem.description || 'Unknown USDA Product',
        calories100g: round(findNutrient(1008, '208')?.value || findNutrient(2047)?.value || 0),
        protein100g: round(findNutrient(1003, '203')?.value || 0),
        fat100g: round(findNutrient(1004, '204')?.value || 0),
        carbs100g: round(findNutrient(1005, '205')?.value || 0),
        grams: 100, source: 'USDA',
      };
    } else { /* OpenFoodFacts */
      const offItem = item as OpenFoodFactsItem;
      const nutriments = offItem.nutriments || {};
      const productName = offItem.product_name_en || offItem.product_name || offItem.generic_name_en || offItem.generic_name || 'Unknown Product';
      let calories = parseFloat(String(nutriments['energy-kcal_100g']));
      if (isNaN(calories) && nutriments.energy_100g) {
          calories = (parseFloat(String(nutriments.energy_100g)) || 0) / 4.184;
      }
      newIngredientData = {
        name: productName + (offItem.brands ? ` - ${offItem.brands}` : ''),
        calories100g: round(calories || 0),
        protein100g: round(parseFloat(String(nutriments.proteins_100g)) || 0),
        fat100g: round(parseFloat(String(nutriments.fat_100g)) || 0),
        carbs100g: round(parseFloat(String(nutriments.carbohydrates_100g)) || 0),
        grams: parseServingSize(offItem.serving_size) || 100, source: 'OpenFoodFacts',
      };
    }
    handleAddIngredient(newIngredientData);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handleManualAddIngredient = () => handleAddIngredient();
  const handleGenericSearchToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchGenericOnly(e.target.checked);
    setSearchResults([]);
    setSearchError(null);
    if (e.target.checked && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY)) {
         setSearchError("Note: USDA API Key is missing. Generic search will not work.");
    }
  };

  const handleFinalSave = () => {
    onSave(currentMeal);
  };


  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pb-4 border-b border-slate-700">
        <div className="flex-grow min-w-0">
            {isEditingName ? (
                <div className="flex items-center gap-2">
                <input
                    ref={mealNameInputRef} type="text" value={currentMeal.name} onChange={handleNameChange}
                    onBlur={saveCurrentMealName} onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentMealName(); if (e.key === 'Escape') cancelEditCurrentMealName(); }}
                    className="font-heading bg-slate-700 text-slate-100 p-2 rounded-md text-xl sm:text-2xl font-semibold border-2 border-teal-500 focus:ring-2 focus:ring-teal-500/80 outline-none flex-grow min-w-0"
                    aria-label="Edit meal name input"
                />
                <button onClick={saveCurrentMealName} className="p-2 text-green-400 hover:text-green-300" aria-label="Save meal name"><CheckSquare size={22}/></button>
                <button onClick={cancelEditCurrentMealName} className="p-2 text-red-400 hover:text-red-300" aria-label="Cancel editing meal name"><XSquare size={22}/></button>
                </div>
            ) : (
                <div className="flex items-center">
                <h3
                    className="font-heading text-xl sm:text-2xl font-semibold text-teal-400 hover:text-teal-300 cursor-pointer truncate"
                    onClick={() => setIsEditingName(true)} title={`Edit: ${currentMeal.name}`}
                >
                    {currentMeal.name}
                </h3>
                <button onClick={() => setIsEditingName(true)} className="ml-2 p-1 text-slate-400 hover:text-teal-400" aria-label="Edit meal name"><Edit3 size={18} /></button>
                </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
                {currentMeal.ingredients.length} ingredient(s).
            </p>
        </div>
        <div className="ml-auto flex-shrink-0">
             <DonutChart
                protein={round(mealTotals.protein)} carbs={round(mealTotals.carbs)} fat={round(mealTotals.fat)}
                totalCalories={round(mealTotals.calories)} size={150} strokeWidth={18} showLegend={true}
            />
        </div>
      </div>
      
      {/* Search Section */}
      <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/60 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-3 items-stretch">
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleFoodSearch()}
            className="w-full bg-slate-600 text-slate-100 p-3 rounded-md border border-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none placeholder-slate-400 flex-grow"
            placeholder="Search food to add ingredients..."
          />
          <button
            onClick={handleFoodSearch} disabled={isSearching || !searchQuery.trim() || (searchGenericOnly && (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY))}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-5 rounded-md shadow hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-60"
          >
            {isSearching ? <Loader2 size={20} className="animate-spin mr-2" /> : <Search size={20} className="mr-2" />}
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 mb-3 text-sm">
            <label className="flex items-center text-slate-300 cursor-pointer">
                <input type="checkbox" checked={searchGenericOnly} onChange={handleGenericSearchToggle}
                    className="mr-2 h-4 w-4 rounded bg-slate-500 border-slate-400 text-green-500 accent-green-500"/>
                <Database size={16} className="mr-1.5 text-green-400"/> Generic Foods (USDA)
            </label>
            {!searchGenericOnly && (
                <label className="flex items-center text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={searchAustraliaOnly} onChange={(e) => setSearchAustraliaOnly(e.target.checked)}
                        className="mr-2 h-4 w-4 rounded bg-slate-500 border-slate-400 text-sky-500 accent-sky-500"/>
                    <ShoppingBasket size={16} className="mr-1.5 text-sky-400" /> Australian Products Only
                </label>
            )}
        </div>
        {searchError && <p className="text-sm text-red-300 my-2 p-2.5 bg-red-900/50 border border-red-700 rounded-md flex items-center"><AlertCircle size={18} className="mr-2"/> {searchError}</p>}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {searchResults.map(item => {
              const itemId = (item as UsdaFoodItem).fdcId || (item as OpenFoodFactsItem).code || Math.random().toString();
              const itemName = item.source === 'USDA' ? (item as UsdaFoodItem).description : ((item as OpenFoodFactsItem).product_name_en || (item as OpenFoodFactsItem).product_name || 'Unknown Product');
              const itemBrand = item.source === 'USDA' ? `USDA (${(item as UsdaFoodItem).dataType || 'Generic'})` : ((item as OpenFoodFactsItem).brands || 'N/A');
              return (
                <div key={itemId} className="p-2.5 bg-slate-600 hover:bg-slate-500/80 rounded-md flex justify-between items-center text-sm gap-2">
                  <div className="flex-grow min-w-0 flex items-center">
                    {item.source === 'USDA' ? <Database size={16} className="text-green-400 mr-2 flex-shrink-0"/> : <ShoppingBasket size={16} className="text-sky-400 mr-2 flex-shrink-0"/>}
                    <div>
                        <p className="font-medium text-slate-100 truncate" title={itemName}>{itemName}</p>
                        <p className="text-xs text-slate-400 truncate" title={itemBrand}>{itemBrand}</p>
                    </div>
                  </div>
                  <button onClick={() => handleAddFoodFromSearch(item)} className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-1.5 px-3 rounded-md shadow transition-colors flex-shrink-0"><PlusCircle size={14} className="inline mr-1"/> Add</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ingredients Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner bg-slate-800/60 mb-6">
        <table className="w-full min-w-[900px] text-sm text-left text-slate-300">
          <caption className="sr-only">Ingredients for {currentMeal.name}</caption>
          <thead className="text-xs text-teal-300 uppercase bg-slate-700 font-heading">
            <tr>
              <th scope="col" className="px-4 py-3 w-1/3">Ingredient</th>
              <th scope="col" className="px-2 py-3 text-center">Cal/100g</th>
              <th scope="col" className="px-2 py-3 text-center">Prot/100g</th>
              <th scope="col" className="px-2 py-3 text-center">Fat/100g</th>
              <th scope="col" className="px-2 py-3 text-center">Carb/100g</th>
              <th scope="col" className="px-2 py-3 text-center">Grams</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold text-teal-200">Calories</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold text-teal-200">Protein</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold text-teal-200">Fat</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold text-teal-200">Carbs</th>
              <th scope="col" className="px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {currentMeal.ingredients.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-slate-400"><Leaf size={24} className="inline mr-2 opacity-60"/>No ingredients yet.</td></tr>
            ) : (
              currentMeal.ingredients.map(ingredient => (
                <IngredientRowComponent
                  key={ingredient.id} ingredient={ingredient}
                  onUpdate={(updatedValues) => handleUpdateIngredient(ingredient.id, updatedValues)}
                  onRemove={() => handleRemoveIngredient(ingredient.id)}
                />
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-700 border-t-2 border-slate-600">
              <tr>
                  <th scope="row" className="px-4 py-3 text-right font-semibold text-slate-100 uppercase text-xs" colSpan={6}>Totals:</th>
                  <td className="px-2 py-3 text-center font-bold text-teal-300">{round(mealTotals.calories)}</td>
                  <td className="px-2 py-3 text-center font-bold text-teal-300">{round(mealTotals.protein)}</td>
                  <td className="px-2 py-3 text-center font-bold text-teal-300">{round(mealTotals.fat)}</td>
                  <td className="px-2 py-3 text-center font-bold text-teal-300">{round(mealTotals.carbs)}</td>
                  <td className="px-3 py-3"></td>
              </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <button
          onClick={handleManualAddIngredient}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-4 rounded-lg shadow flex items-center group w-full sm:w-auto"
        >
          <PlusCircle size={18} className="mr-2 group-hover:animate-pulse-gentle-hover" /> Add Ingredient Manually
        </button>
      </div>

       {/* Save/Action buttons for the modal */}
      <div className="p-4 mt-6 border-t border-slate-700 flex flex-col sm:flex-row justify-end items-center gap-3">
        <button onClick={onClose} className="text-slate-300 hover:bg-slate-600 py-2.5 px-5 rounded-lg w-full sm:w-auto">Cancel</button>
        {editingMode === 'instance' && onSaveAsTemplate && (
            <button onClick={() => onSaveAsTemplate(currentMeal as MealInstance)} className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-5 rounded-lg shadow flex items-center justify-center w-full sm:w-auto">
                <Star size={16} className="mr-2"/> Save as New Template
            </button>
        )}
        <button onClick={handleFinalSave} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow w-full sm:w-auto">
            <Save size={16} className="mr-2"/>
            {editingMode === 'template' ? 'Save Template' : 'Save Meal to Day'}
        </button>
      </div>
    </div>
  );
};

  export default MealComponent;