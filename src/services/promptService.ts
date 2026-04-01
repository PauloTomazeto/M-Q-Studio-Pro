import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  increment,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface Prompt {
  id: string;
  content: string;
  version: number;
  isAiGenerated: boolean;
  qualityScore: number;
  qualityBreakdown: {
    clarity: number;
    specificity: number;
    coherence: number;
    brevity: number;
  };
  wordCount: number;
  characterCount: number;
  promptMode: 'single' | 'blocks';
  tags: string[];
  createdAt: any;
  updatedAt: any;
  createdByUserId: string;
  lastEditedByUserId: string | null;
  copyCount: number;
  isFavorite: boolean;
  visibility: 'private' | 'shared' | 'public';
  promptSource: 'gemini_ai' | 'manual' | 'edited_from_ai' | 'imported';
  isLocked: boolean;
  lockReason?: string;
  usageCount: number;
}

export interface PromptVersion {
  version: number;
  content: string;
  editedBy: string;
  timestamp: any;
  qualityScore: number;
}

export const promptService = {
  async saveGeneratedPrompt(data: Partial<Prompt>): Promise<string> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    const promptId = uuidv4();
    const now = new Date().toISOString();
    
    const wordCount = (data.content || '').split(/\s+/).length;
    const charCount = (data.content || '').length;

    const prompt: Prompt = {
      id: promptId,
      content: data.content || '',
      version: 1,
      isAiGenerated: data.isAiGenerated ?? true,
      qualityScore: data.qualityScore || 85,
      qualityBreakdown: data.qualityBreakdown || { clarity: 80, specificity: 80, coherence: 80, brevity: 80 },
      wordCount,
      characterCount: charCount,
      promptMode: data.promptMode || 'single',
      tags: data.tags || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUserId: userId,
      lastEditedByUserId: null,
      copyCount: 0,
      isFavorite: false,
      visibility: data.visibility || 'private',
      promptSource: data.promptSource || 'gemini_ai',
      isLocked: false,
      usageCount: 0,
      ...data
    };

    await setDoc(doc(db, 'prompts', promptId), prompt);

    // Initial version
    await setDoc(doc(db, 'prompts', promptId, 'versions', 'v1'), {
      version: 1,
      content: prompt.content,
      editedBy: userId,
      timestamp: serverTimestamp(),
      qualityScore: prompt.qualityScore
    });

    return promptId;
  },

  async updatePrompt(promptId: string, newContent: string, qualityScore?: number): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    const promptRef = doc(db, 'prompts', promptId);
    const promptSnap = await getDoc(promptRef);
    
    if (!promptSnap.exists()) throw new Error('PROMPT_NOT_FOUND');
    const currentData = promptSnap.data() as Prompt;

    if (currentData.isLocked) throw new Error(`PROMPT_LOCKED: ${currentData.lockReason}`);

    const newVersion = currentData.version + 1;
    const wordCount = newContent.split(/\s+/).length;
    const charCount = newContent.length;

    await updateDoc(promptRef, {
      content: newContent,
      version: newVersion,
      isAiGenerated: false,
      promptSource: 'edited_from_ai',
      qualityScore: qualityScore || currentData.qualityScore, // Ideally recalculate
      wordCount,
      characterCount: charCount,
      updatedAt: serverTimestamp(),
      lastEditedByUserId: userId
    });

    // Save version
    await setDoc(doc(db, 'prompts', promptId, 'versions', `v${newVersion}`), {
      version: newVersion,
      content: newContent,
      editedBy: userId,
      timestamp: serverTimestamp(),
      qualityScore: qualityScore || currentData.qualityScore
    });
  },

  async toggleFavorite(promptId: string, isFavorite: boolean): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    await updateDoc(doc(db, 'prompts', promptId), { isFavorite });

    const favId = `${userId}_${promptId}`;
    if (isFavorite) {
      await setDoc(doc(db, 'user_prompt_favorites', favId), {
        userId,
        promptId,
        createdAt: serverTimestamp()
      });
    } else {
      await deleteDoc(doc(db, 'user_prompt_favorites', favId));
    }
  },

  async incrementCopyCount(promptId: string): Promise<void> {
    await updateDoc(doc(db, 'prompts', promptId), {
      copyCount: increment(1)
    });
  },

  async setVisibility(promptId: string, visibility: 'private' | 'shared' | 'public'): Promise<void> {
    await updateDoc(doc(db, 'prompts', promptId), { visibility });
  },

  async shareWithUser(promptId: string, targetUserId: string, shareType: 'view' | 'edit' = 'view'): Promise<void> {
    const shareId = `${targetUserId}_${promptId}`;
    await setDoc(doc(db, 'user_prompt_shares', shareId), {
      userId: targetUserId,
      promptId,
      shareType,
      createdAt: serverTimestamp()
    });
  },

  async getUserPrompts(): Promise<Prompt[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('AUTH_REQUIRED');

    const q = query(
      collection(db, 'prompts'),
      where('createdByUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Prompt);
  },

  async getPublicPrompts(): Promise<Prompt[]> {
    const q = query(
      collection(db, 'prompts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Prompt);
  }
};
