import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';

export interface UserStats {
  totalUsers: number;
  premiumUsers: number;
  proUsers: number;
  basicUsers: number;
  totalRevenue: number;
  revenueByPlan: {
    basic: number;
    pro: number;
    premium: number;
  };
  subscriptionCounts: {
    active: number;
    inactive: number;
    canceled: number;
    trialing: number;
  };
  usageStats: {
    prompt: number;
    scan: number;
    read: number;
    image: number;
    video: number;
  };
}

export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  stripePriceId?: string;
}

export interface CreditPackageConfig {
  id: string;
  amount: number;
  price: number;
  updatedAt: string;
}

export const adminService = {
  async getStats(): Promise<UserStats> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const stats: UserStats = {
        totalUsers: usersSnap.size,
        premiumUsers: 0,
        proUsers: 0,
        basicUsers: 0,
        totalRevenue: 0,
        revenueByPlan: { basic: 0, pro: 0, premium: 0 },
        subscriptionCounts: { active: 0, inactive: 0, canceled: 0, trialing: 0 },
        usageStats: { prompt: 0, scan: 0, read: 0, image: 0, video: 0 }
      };

      const usageSnap = await getDocs(collection(db, 'usage_logs'));
      usageSnap.forEach(doc => {
        const type = doc.data().type as keyof typeof stats.usageStats;
        if (stats.usageStats[type] !== undefined) {
          stats.usageStats[type]++;
        }
      });

      const plansSnap = await getDocs(collection(db, 'plans'));
      const planPrices: Record<string, number> = {};
      plansSnap.forEach(doc => {
        planPrices[doc.id] = doc.data().price;
      });

      usersSnap.forEach(doc => {
        const data = doc.data();
        // Plan counts
        if (data.plan === 'premium') stats.premiumUsers++;
        else if (data.plan === 'pro') stats.proUsers++;
        else stats.basicUsers++;

        // Subscription status counts
        const status = data.subscriptionStatus || 'inactive';
        if (status === 'active') stats.subscriptionCounts.active++;
        else if (status === 'canceled') stats.subscriptionCounts.canceled++;
        else if (status === 'trialing') stats.subscriptionCounts.trialing++;
        else stats.subscriptionCounts.inactive++;

        // Revenue calculation
        if (status === 'active') {
          const price = planPrices[data.plan] || 0;
          stats.totalRevenue += price;
          if (data.plan === 'premium') stats.revenueByPlan.premium += price;
          else if (data.plan === 'pro') stats.revenueByPlan.pro += price;
          else stats.revenueByPlan.basic += price;
        }
      });

      return stats;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users/stats');
      throw error;
    }
  },

  async getAllUsers(limitCount = 50) {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
      throw error;
    }
  },

  async createUser(userData: {
    email: string;
    displayName: string;
    plan: string;
    credits: number;
    role: string;
    subscriptionStatus: string;
  }) {
    try {
      const userId = userData.email.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
      const now = Timestamp.now();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      await setDoc(doc(db, 'users', userId), {
        ...userData,
        uid: userId,
        createdAt: now,
        updatedAt: now,
        monthlySpent: 0,
        monthlyLimit: userData.plan === 'premium' ? 5000 : userData.plan === 'pro' ? 1000 : 200,
        resetDate: Timestamp.fromDate(nextMonth)
      });
      return userId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      throw error;
    }
  },

  async updateUserPlan(userId: string, plan: string, credits: number, subscriptionStatus: string) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        plan,
        credits,
        subscriptionStatus: subscriptionStatus || 'inactive',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  },

  async getPlans(): Promise<PlanConfig[]> {
    try {
      const snap = await getDocs(collection(db, 'plans'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanConfig));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'plans');
      throw error;
    }
  },

  async getCreditPackage(): Promise<CreditPackageConfig> {
    try {
      const docRef = doc(db, 'config', 'credit_package');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as CreditPackageConfig;
      }
      // Default if not exists
      const defaultConfig = {
        amount: 1000,
        price: 99.00,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, defaultConfig);
      return { id: 'credit_package', ...defaultConfig };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'config/credit_package');
      throw error;
    }
  },

  async updateCreditPackage(amount: number, price: number) {
    try {
      await updateDoc(doc(db, 'config', 'credit_package'), {
        amount,
        price,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/credit_package');
      throw error;
    }
  },

  async updatePlan(planId: string, price: number, credits: number) {
    try {
      await updateDoc(doc(db, 'plans', planId), {
        price,
        credits,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
      throw error;
    }
  },

  async deleteUser(userId: string) {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      throw error;
    }
  },

  async bootstrapPlans() {
    const plans = [
      { id: 'basic', name: 'Básico', price: 89.99, credits: 200, features: ['Geração de Prompts', 'Visualização de Imagens', '200 Créditos'] },
      { id: 'pro', name: 'Profissional', price: 159.99, credits: 1000, features: ['Tudo no Básico', '1.000 Créditos', 'Geração de Imagens', 'Suporte Prioritário'] },
      { id: 'premium', name: 'Premium', price: 199.99, credits: 5000, features: ['Tudo no Pro', '5.000 Créditos', 'Geração de Vídeos', 'Acesso Antecipado'] }
    ];

    for (const plan of plans) {
      await setDoc(doc(db, 'plans', plan.id), {
        ...plan,
        updatedAt: Timestamp.now()
      }, { merge: true });
    }
  }
};
