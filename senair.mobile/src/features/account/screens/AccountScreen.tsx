import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, Trash2 } from 'lucide-react-native';
import { ROLE_LABELS, formatDateTime, type HealthProfileId, type Me } from '@senair/core';
import { useSession } from '@/shared/api/AppProviders';
import { Button, Card, Screen, ScreenTitle, SectionHeader, TextField } from '@/shared/ui';
import { COLORS, SPACING, TYPE } from '@/theme';
import { FormError, FormNotice } from '../components/FormError';
import { HealthProfileSelect } from '../components/HealthProfileSelect';
import { RequireAccount } from '../components/RequireAccount';
import { ZoneMultiSelect } from '../components/ZoneMultiSelect';
import { serverErrors } from '../formErrors';
import { useDeleteAccount, useSignOut, useUpdateProfile } from '../hooks/useAuthActions';

function ProfileForm({ user }: { user: Me }) {
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(user.fullName);
  const [zoneIds, setZoneIds] = useState(user.zoneIds);
  const [healthProfile, setHealthProfile] = useState<HealthProfileId | null>(user.healthProfile);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName);
    setZoneIds(user.zoneIds);
    setHealthProfile(user.healthProfile);
  }, [user]);

  const save = async () => {
    setNotice(null);
    setError(null);
    if (fullName.trim().length < 2) return setError('Nom trop court');
    try {
      await update.mutateAsync({
        fullName: fullName.trim(),
        zoneIds,
        healthProfile,
      });
      setNotice('Profil enregistré.');
    } catch (e) {
      setError(serverErrors(e).form);
    }
  };

  return (
    <View>
      <FormError message={error} />
      <FormNotice message={notice} />
      <TextField label="Nom complet" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <ZoneMultiSelect value={zoneIds} onChange={setZoneIds} />
      <HealthProfileSelect value={healthProfile} onChange={setHealthProfile} hint="Facultatif : adapte les conseils santé." />
      <Button label="Enregistrer" onPress={() => void save()} loading={update.isPending} />
    </View>
  );
}

function AccountContent() {
  const { user } = useSession();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  if (!user) return null;

  const confirmDelete = () =>
    Alert.alert('Supprimer mon compte', 'Votre compte, vos zones, votre profil santé et vos préférences seront supprimés définitivement. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () =>
          deleteAccount.mutate(undefined, {
            onSuccess: () => router.replace('/'),
          }),
      },
    ]);

  return (
    <View>
      <Card style={styles.identity}>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.sub}>{user.email}</Text>
        <Text style={styles.sub}>
          {ROLE_LABELS[user.role]}, inscrit le {formatDateTime(user.createdAt)}
        </Text>
      </Card>
      <SectionHeader title="Mon profil" />
      <ProfileForm user={user} />
      <SectionHeader title="Session" />
      <Button
        label="Se déconnecter"
        variant="secondary"
        icon={<LogOut size={18} color={COLORS.primary} />}
        loading={signOut.isPending}
        onPress={() => signOut.mutate(undefined, { onSettled: () => router.replace('/') })}
      />
      <FormError message={deleteAccount.isError ? serverErrors(deleteAccount.error).form : null} />
      <Button
        label="Supprimer mon compte"
        variant="danger"
        icon={<Trash2 size={18} color={COLORS.danger} />}
        loading={deleteAccount.isPending}
        onPress={confirmDelete}
        style={styles.spaced}
      />
    </View>
  );
}

export function AccountScreen() {
  return (
    <Screen topInset={false}>
      <ScreenTitle title="Mon compte" />
      <RequireAccount reason="Connectez-vous pour gérer vos zones, votre profil santé et vos alertes.">
        <AccountContent />
      </RequireAccount>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { gap: 2 },
  name: { ...TYPE.h2, color: COLORS.text },
  sub: { ...TYPE.small, color: COLORS.textSecondary },
  spaced: { marginTop: SPACING.lg },
});
