import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { styles } from './styles';

export function WorkshopBand() {
  return (
    <>
      {/* Workshop band — real garages, real people */}
      <View style={styles.bandFull}>
        <Image
          source={require('../../../assets/images/workshop-1.jpg')}
          style={styles.bandImage}
          contentFit="cover"
          contentPosition="center"
          transition={200}
        />
        <View style={styles.bandScrim} />
        <View style={styles.bandContent}>
          <Text style={styles.bandTitle}>Real garages.{`\n`}Real mechanics.</Text>
          <Text style={styles.bandMeta}>Every partner verified before quoting</Text>
        </View>
      </View>
    </>
  );
}
