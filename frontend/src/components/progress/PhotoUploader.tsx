import { useState } from 'react';
import { CameraIcon, ImagePlusIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { card } from '../../utils/styles';

export function PhotoUploader() {
  const { selectedWeek, weekly, addPhoto, t } = useApp();
  const [error, setError] = useState('');
  const photos = weekly[selectedWeek]?.photos ?? [];
  const upload = async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 10 * 1024 * 1024) { setError(t('errPhotoType')); return; }
    try { await addPhoto(selectedWeek, file, { label: '', note: '', capturedOn: selectedWeek }); } catch (e) { setError((e as Error).message); }
  };
  return <section className={`${card} p-5`}><div className="flex items-center gap-3"><CameraIcon className="h-5 w-5 text-brand-600"/><h2 className="font-display text-lg font-bold">{t('weeklyPhotos')}</h2></div><p className="mt-2 text-sm text-ink-soft">{photos.length}/4</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-6 text-brand-700"><ImagePlusIcon/><span>{t('addPhotos')}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f=e.target.files?.[0]; if(f) void upload(f); }} /></label>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</section>;
}
