/**
 * Compatibility Layer for Firebase → Supabase Migration
 * Este arquivo atua como ponte entre o código antigo (Firebase) e o novo (Supabase)
 * Permite que o projeto continue funcionando durante a migração gradual
 *
 * NOTA: Este é um arquivo temporário. Remova conforme refatorar componentes para Supabase.
 */

import { supabase } from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================
// AUTH COMPATIBILITY
// ============================================================

export const auth = {
  get currentUser() {
    // Nota: Em Supabase, o usuário é obtido de forma assíncrona ou da sessão atual
    // Para compatibilidade síncrona, tentamos pegar da sessão persistida se houver
    const session = supabase.auth.getSession();
    // @ts-ignore - Tentativa de retorno síncrono para compatibilidade
    return (supabase as any).auth?.session()?.user || null;
  },

  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChanged: (callback: (user: any | null) => void) => {
    // Chama o callback imediatamente com o usuário atual se existir
    supabase.auth.getUser().then(({ data: { user } }) => {
      callback(user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
    return () => subscription?.unsubscribe();
  },

  signOut: async () => {
    return await supabase.auth.signOut();
  }
};

/**
 * Função de compatibilidade para signInWithPopup
 */
export const signInWithPopup = async (_auth: any, _provider: any) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  
  if (error) throw error;
  return data;
};

// ============================================================
// DATABASE COMPATIBILITY
// ============================================================

export const db = {
  collection: (name: string) => ({ name }),
  doc: (collectionName: string, docId: string) => ({ collection: collectionName, id: docId })
};

// ============================================================
// GOOGLE AUTH PROVIDER
// ============================================================

export const googleProvider = {
  providerId: 'google.com'
};

// ============================================================
// ADMIN EMAILS
// ============================================================

export const ADMIN_EMAILS = [
  "paulosilvatomazeto@gmail.com",
  "paulo.silva.tamazeta@gmail.com"
];

export const isAdminEmail = (email: string | null | undefined) => {
  return email && ADMIN_EMAILS.includes(email);
};

// ============================================================
// OPERATION TYPES
// ============================================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  // Nota: handleFirestoreError agora é síncrona para compatibilidade, 
  // mas tenta logar o erro com o que tiver disponível
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.error('Supabase/Firestore Bridge Error: ', errInfo);
  throw error;
}

// ============================================================
// FIRESTORE COMPATIBILITY STUBS
// ============================================================

export async function doc(collectionName: string, docId: string) {
  return { collection: collectionName, id: docId };
}

export async function getDoc(ref: any) {
  try {
    const { data, error } = await supabase
      .from(ref.collection)
      .select('*')
      .eq('id', ref.id)
      .single();

    if (error) throw error;

    return {
      exists: () => !!data,
      data: () => data,
      id: ref.id,
      ref: ref
    };
  } catch (error) {
    return {
      exists: () => false,
      data: () => null,
      id: ref.id,
      ref: ref
    };
  }
}

export async function setDoc(ref: any, data: any) {
  const { error } = await supabase
    .from(ref.collection)
    .upsert({ id: ref.id, ...data }, { onConflict: 'id' });

  if (error) throw error;
}

export async function updateDoc(ref: any, updates: any) {
  const { error } = await supabase
    .from(ref.collection)
    .update(updates)
    .eq('id', ref.id);

  if (error) throw error;
}

export async function deleteDoc(ref: any) {
  const { error } = await supabase
    .from(ref.collection)
    .delete()
    .eq('id', ref.id);

  if (error) throw error;
}

export function collection(name: string) {
  return { name };
}

export function query(coll: any, ...constraints: any[]) {
  return { collection: coll.name, constraints };
}

export function where(field: string, operator: string, value: any) {
  return { field, operator, value };
}

export async function getDocs(q: any) {
  try {
    let query = supabase.from(q.collection).select('*');

    if (q.constraints && q.constraints.length > 0) {
      for (const constraint of q.constraints) {
        if (constraint.field && constraint.operator && constraint.value !== undefined) {
          if (constraint.operator === '==') {
            query = query.eq(constraint.field, constraint.value);
          } else if (constraint.operator === '<') {
            query = query.lt(constraint.field, constraint.value);
          } else if (constraint.operator === '<=') {
            query = query.lte(constraint.field, constraint.value);
          } else if (constraint.operator === '>') {
            query = query.gt(constraint.field, constraint.value);
          } else if (constraint.operator === '>=') {
            query = query.gte(constraint.field, constraint.value);
          }
        }
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      empty: !data || data.length === 0,
      docs: (data || []).map((item: any) => ({
        id: item.id,
        data: () => item,
        ref: { collection: q.collection, id: item.id }
      }))
    };
  } catch (error) {
    return {
      empty: true,
      docs: []
    };
  }
}

export function onSnapshot(ref: any, callback: (doc: any) => void) {
  const channel = supabase
    .channel(`${ref.collection}-${ref.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: ref.collection,
        filter: `id=eq.${ref.id}`
      },
      async (payload) => {
        const doc = await getDoc(ref);
        callback(doc);
      }
    )
    .subscribe();

  return () => channel.unsubscribe();
}

export async function getDocFromServer(ref: any) {
  return await getDoc(ref);
}

export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error && error.code !== '42P01') {
      // 42P01 = table doesn't exist
      console.error("Please check your Supabase configuration.");
    }
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

testConnection();
