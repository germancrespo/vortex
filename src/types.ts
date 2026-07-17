export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string; // ISO date string YYYY-MM-DD
}

export interface Budget {
  category: string;
  limit: number;
  spent: number;
}

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rateVsUsd: number; // Conversion rate vs USD
}

export interface ForecastResponse {
  pair: string;
  prediction: 'up' | 'down' | 'stable';
  expectedRange: string;
  confidence: number; // percentage, e.g. 85
  analysis: string; // Markdown or plain text in Spanish explaining why
  recommendation: string; // Advice in Spanish
}

export interface AdviceResponse {
  score: number; // Health score 1-100
  generalFeedback: string;
  warnings: string[];
  tips: string[];
}

export interface NaturalLanguageExtractionResponse {
  success: boolean;
  type: 'expense' | 'income';
  description: string;
  amount: number;
  currency: string;
  category: string;
  rawInput: string;
}
