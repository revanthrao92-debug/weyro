import { Text, View } from 'react-native';
import { SectionHead as Head } from '@/components/ui';

import { styles } from './styles';

export function AssuranceSection() {
  return (
    <>
      {/* Assurance */}
      <Head title="Assurance" />
      <View style={styles.assurance}>
        {[
          ['Verified garages', 'Every partner is reviewed before quoting'],
          ['Photo-based quotes', 'Prices come from the photos you upload'],
          ['Protected payments', 'Released after the work is confirmed complete'],
        ].map(([label, detail], i) => (
          <View key={label} style={[styles.assuranceRow, i > 0 && styles.rowDivider]}>
            <Text style={styles.assuranceLabel}>{label}</Text>
            <Text style={styles.assuranceDetail}>{detail}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
