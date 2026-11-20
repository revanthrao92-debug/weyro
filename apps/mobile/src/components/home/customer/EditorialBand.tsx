import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { styles } from './styles';

export function EditorialBand() {
  return (
    <>
      {/* Editorial image band — one owned photo, one line */}
      <View style={styles.bandFull}>
        <Image
          source={require('../../../../assets/images/hero-secondary.jpg')}
          style={styles.bandImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.bandScrim} />
        <View style={styles.bandContent}>
          <Text style={styles.bandTitle}>Every repair,{`
      `}documented.</Text>
          <Text style={styles.bandMeta}>Photo quotes · protected payments</Text>
        </View>
      </View>
    </>
  );
}
