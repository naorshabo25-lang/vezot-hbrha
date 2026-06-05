import { useState, useEffect } from 'react';

const STORAGE_KEY = 'company_expenses';
const BUDGET_KEY = 'company_budgets';

const DEFAULT_CATEGORIES = [
  'שכר עובדים', 'שיווק ופרסום', 'ציוד משרדי', 'שכירות', 'חשמל ומים',
  'תוכנה ורישיונות', 'נסיעות', 'ייעוץ מקצועי', 'אחר'
];

export function useExpenses() {
  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [budgets, setBudgets] = useState(() => {
    try {
      const saved = localStorage.getItem(BUDGET_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
  }, [budgets]);

  const addExpense = (expense) => {
    const newExpense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setExpenses(prev => [newExpense, ...prev]);
    return newExpense;
  };

  const updateExpense = (id, data) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const deleteExpense = (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const importExpenses = (newExpenses) => {
    const formatted = newExpenses.map(e => ({
      ...e,
      id: e.id || Date.now().toString() + Math.random(),
      createdAt: e.createdAt || new Date().toISOString(),
    }));
    setExpenses(prev => [...formatted, ...prev]);
  };

  const clearAllExpenses = () => {
    setExpenses([]);
  };

  const setBudget = (category, amount) => {
    setBudgets(prev => ({ ...prev, [category]: Number(amount) }));
  };

  const getMonthlyTotal = (month, year) => {
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  };

  const getCategoryTotal = (category, month, year) => {
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        const matchMonth = month !== undefined ? d.getMonth() === month && d.getFullYear() === year : true;
        return e.category === category && matchMonth;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  };

  return {
    expenses,
    budgets,
    categories: DEFAULT_CATEGORIES,
    addExpense,
    updateExpense,
    deleteExpense,
    clearAllExpenses,
    importExpenses,
    setBudget,
    getMonthlyTotal,
    getCategoryTotal,
  };
}
