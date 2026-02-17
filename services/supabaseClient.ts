import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let supabase: SupabaseClient | null = null;

// Initialize Supabase client only if credentials are provided
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export interface StoredConfig {
  id?: number;
  config_name: string;
  configs: any;
  libraries: any;
  updated_at?: string;
  created_at?: string;
}

/**
 * Save config to Supabase
 * Uses single shared config approach for all users
 */
export async function saveConfigToSupabase(configs: any, libraries: any) {
  if (!supabase) {
    console.warn('Supabase is not configured. Config will be saved to localStorage only.');
    return null;
  }

  try {
    const payload: StoredConfig = {
      config_name: 'default',
      configs,
      libraries,
      updated_at: new Date().toISOString(),
    };

    // Try to update existing config, if it doesn't exist, insert it
    const { data: existingConfig, error: fetchError } = await supabase
      .from('app_configs')
      .select('id')
      .eq('config_name', 'default')
      .single() as { data: { id: number } | null; error: any };

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows returned (which is expected for first save)
      throw fetchError;
    }

    let result: any;
    if (existingConfig?.id) {
      // Update existing
      result = await supabase
        .from('app_configs')
        .update(payload as Record<string, any>)
        .eq('id', existingConfig.id)
        .select();
    } else {
      // Insert new
      result = await supabase
        .from('app_configs')
        .insert([payload as Record<string, any>])
        .select();
    }

    if (result.error) {
      console.error('Supabase save error:', result.error);
      return null;
    }

    console.log('Config saved to Supabase successfully');
    return result.data?.[0] || null;
  } catch (error) {
    console.error('Error saving config to Supabase:', error);
    return null;
  }
}

/**
 * Load config from Supabase
 * Returns null if Supabase is not configured or config doesn't exist
 */
export async function loadConfigFromSupabase() {
  if (!supabase) {
    console.warn('Supabase is not configured. Will use localStorage or defaults.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('app_configs')
      .select('*')
      .eq('config_name', 'default')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config found yet
        console.log('No config found in Supabase yet');
        return null;
      }
      throw error;
    }

    console.log('Config loaded from Supabase');
    return data as StoredConfig | null;
  } catch (error) {
    console.error('Error loading config from Supabase:', error);
    return null;
  }
}

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!supabase && !!supabaseUrl && !!supabaseAnonKey;
}

export default supabase;
