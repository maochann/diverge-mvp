import { supabase } from '@/lib/supabase';
import type { UpdatePolicy } from '@/lib/version';

/** What the server says about app versions. Null when it cannot be read. */
export interface AppConfig {
  update: UpdatePolicy;
  /** Where to send people for the update. */
  storeUrl: string;
}

const KEYS = ['ios_latest_version', 'ios_min_version', 'ios_store_url'] as const;

export async function fetchAppConfig(): Promise<AppConfig | null> {
  const { data, error } = await supabase.from('app_config').select('key,value').in('key', [...KEYS]);
  if (error || !data) return null;
  const map = new Map(data.map((row: { key: string; value: string }) => [row.key, row.value]));
  const latest = map.get('ios_latest_version');
  const min = map.get('ios_min_version');
  const storeUrl = map.get('ios_store_url');
  if (!latest || !min || !storeUrl) return null;
  return { update: { latest, min }, storeUrl };
}
