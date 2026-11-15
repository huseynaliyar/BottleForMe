import { useState } from 'react';
import { View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useLanguage } from '../../lib/language-context';
import { profileRating, profileReviewDate, profileReviewRoles, type ProfileReviewRole } from '../../lib/profile-reviews';
import { useProfileReviews } from '../../lib/use-profile-reviews';
import { getProfileReviews } from './backend';
import { Button, Card, ErrorText, Loading, Segmented, Text, useUi } from './ui';

export function ProfileReviews({ userId, activeRole }: { userId: string; activeRole: ProfileReviewRole }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [selectedRole, setSelectedRole] = useState<ProfileReviewRole>();
  const role = selectedRole ?? activeRole;

  return <Card>
    <Text accessibilityRole="header" weight="bold" style={styles.body}>{t('Reviews received')}</Text>
    <Segmented options={profileReviewRoles.map((option) => ({
      value: option, label: t(option === 'giver' ? 'Giver' : 'Taker'),
    }))} value={role} onChange={setSelectedRole} />
    <ReviewsForRole key={role} userId={userId} role={role} />
  </Card>;
}

function ReviewsForRole({ userId, role }: { userId: string; role: ProfileReviewRole }) {
  const { t, locale } = useLanguage();
  const { styles, colors } = useUi();
  const { data, loading, error, hasPrevious, hasNext, setPage, retry } = useProfileReviews(userId, role, getProfileReviews);

  if (loading) return <Loading label={t('Loading reviews…')} />;
  if (error || !data) return <>
    <ErrorText message={t('Could not load your reviews.')} />
    <Button label={t('Retry')} kind="secondary" onPress={retry} />
  </>;
  if (!data.count) return <Text style={styles.muted}>{t('No ratings yet')}</Text>;

  return <>
    <View style={[styles.inset, styles.row]}>
      <Star size={16} color={colors.blue} />
      {data.average !== null && <Text weight="bold" style={styles.body}>{profileRating(locale, data.average)}</Text>}
      <Text style={styles.muted}>{t('Reviews')} · {data.count.toLocaleString(locale)}</Text>
    </View>
    {data.reviews.map((review) => <View key={review.pickupId} style={styles.rule}>
      <View style={[styles.between, { flexWrap: 'wrap', gap: 4 }]}>
        <Text weight="semibold" style={styles.small}>{profileRating(locale, review.stars)}</Text>
        {review.pickupDate && <Text style={styles.muted}>{t('Pickup date')} {profileReviewDate(locale, review.pickupDate)}</Text>}
      </View>
      {!!review.comment.trim() && <Text style={[styles.small, { writingDirection: 'auto' }]}>{review.comment}</Text>}
    </View>)}
    {(hasPrevious || hasNext) && <View style={[styles.row, { flexWrap: 'wrap' }]}>
      <Button label={t('Previous page')} kind="secondary" disabled={!hasPrevious} onPress={() => setPage((value) => value - 1)} />
      <Button label={t('Next page')} kind="secondary" disabled={!hasNext} onPress={() => setPage((value) => value + 1)} />
    </View>}
  </>;
}
