import React from 'react';
import { useApp } from '../contexts/AppContext';
import { PageHeader } from '../components/ui/PageHeader';
import { PhotoGallery } from '../components/progress/PhotoGallery';
import { PhotoUploader } from '../components/progress/PhotoUploader';
import { PrivacyNote } from '../components/progress/PrivacyNote';
import { WeightCard } from '../components/progress/WeightCard';
import { WeightChart } from '../components/progress/WeightChart';

export function Progress() {
  const { t, loading } = useApp();
  return (
    <>
      <PageHeader title={t('progressTitle')} intro={t('progressIntro')} />
      <div className="mb-5">
        <PrivacyNote />
      </div>
      {loading ?
      <div className="grid gap-4 lg:grid-cols-2" role="status">
          <span className="sr-only">{t('loading')}</span>
          <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-line" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-line" />
        </div> :

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="space-y-4">
            <WeightCard />
            <WeightChart />
          </div>
          <div className="space-y-4">
            <PhotoUploader />
            <PhotoGallery />
          </div>
        </div>
      }
    </>);

}