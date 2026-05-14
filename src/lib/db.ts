import Dexie, { type EntityTable } from 'dexie';

export interface Shop {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: number;
  shopId: number;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: number;
  shopId: number;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  total: number;
  tax?: number;
  discount?: number;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface Expense {
  id: number;
  shopId: number;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  createdAt: Date;
}

class MicrostoreDB extends Dexie {
  shops!: EntityTable<Shop, 'id'>;
  items!: EntityTable<Item, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;

  constructor() {
    super('MicrostoreDB');
    this.version(1).stores({
      shops: '++id, name, createdAt',
      items: '++id, shopId, name, category, sku, barcode, createdAt',
      orders: '++id, shopId, status, createdAt',
      expenses: '++id, shopId, category, date',
    });
  }
}

export const db = new MicrostoreDB();
