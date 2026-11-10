import { useEffect, useState } from 'react';

const milestones = [
  { threshold: 1000, title: '1,000 containers handed over' },
  { threshold: 500, title: '500 containers handed over' },
  { threshold: 100, title: '100 containers handed over' },
  { threshold: 1, title: 'First completed pickup' },
];

export function useImpactAchievement(userId: string, containers: number, completed: number,
  load: (key: string) => Promise<string | null>, persist: (key: string, value: string) => Promise<void>) {
  const key = 'bottleforme-impact-' + userId;
  const [seen, setSeen] = useState<number>();
  useEffect(() => {
    let active = true;
    void load(key).then((value) => {
      if (active) setSeen(Number(value) || 0);
    }).catch(() => { if (active) setSeen(0); });
    return () => { active = false; };
  }, [key, load]);

  const achievement = seen === undefined || !completed ? undefined
    : milestones.find(({ threshold }) => threshold > seen && threshold <= Math.max(containers, 1));
  function dismiss() {
    if (!achievement) return;
    setSeen(achievement.threshold);
    void persist(key, String(achievement.threshold)).catch(() => {});
  }
  return { achievement, dismiss };
}
