import Animated from 'react-native-reanimated';
import { Screen, ScreenTitle, SectionHeader } from '@/shared/ui';
import { useMotion } from '@/shared/motion/useMotion';
import { AqiScaleList } from '../components/AqiScaleList';
import { PollutantGuide } from '../components/PollutantGuide';
import { StandardsTable } from '../components/StandardsTable';

/** Contenu pédagogique : échelle IQA, normes OMS 2021 et NS 05-062, polluants. */
export function ComprendreScreen() {
  const motion = useMotion();
  return (
    <Screen topInset={false}>
      <ScreenTitle title="La qualité de l'air, simplement" subtitle="Ce que signifient les chiffres affichés dans SEN-AIR" />
      <Animated.View entering={motion.enter(0)}>
        <SectionHeader title="Échelle de l'IQA" subtitle="6 niveaux, du vert au bordeaux" />
        <AqiScaleList />
      </Animated.View>
      <Animated.View entering={motion.enter(1)}>
        <SectionHeader title="Normes" subtitle="OMS 2021 et norme sénégalaise NS 05-062" />
        <StandardsTable />
      </Animated.View>
      <Animated.View entering={motion.enter(2)}>
        <SectionHeader title="Polluants" subtitle="Origines et effets sur la santé" />
        <PollutantGuide />
      </Animated.View>
    </Screen>
  );
}
