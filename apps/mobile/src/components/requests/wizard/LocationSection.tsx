import { Text, View } from 'react-native';
import { Chip, SectionHead } from '@/components/ui';
import { LocationField, type PickedLocation } from '@/maps';
import { type RequestErrorMap, type ServiceConfig, type SpareFulfillment } from '../serviceRequestConfig';

import { styles } from './wizardStyles';
import { SavedPlace } from './WizardParts';

export function LocationSection({ config, location, dropoff, savedLocation, errors, spareFulfillment, setSpareFulfillment, setPicker, clearError }: {
  config: ServiceConfig;
  location: PickedLocation | null;
  dropoff: PickedLocation | null;
  savedLocation: PickedLocation | null;
  errors: RequestErrorMap;
  spareFulfillment: SpareFulfillment;
  setSpareFulfillment: (value: SpareFulfillment) => void;
  setPicker: (picker: 'pickup' | 'dropoff' | null) => void;
  clearError: (key: string) => void;
}) {
  return (
    <>
      <SectionHead
        index="02"
        title={config.locationMode === 'trip' ? 'Route' : 'Location'}
      />
      {config.locationMode === 'trip' ? (
        <>
          <LocationField
            label="Pickup point"
            value={location}
            placeholder="Where is the vehicle now?"
            onPress={() => setPicker('pickup')}
            error={errors.location}
            hint="Confirm the pickup point. Drag the pin to fine-tune."
          />
          <View style={styles.fieldGap} />
          <LocationField
            label="Destination"
            value={dropoff}
            placeholder="Where should it be towed?"
            onPress={() => setPicker('dropoff')}
            error={errors.dropoff}
            hint="The destination can be a garage or any address."
          />
        </>
      ) : config.locationMode === 'spare' ? (
        <>
          <Text style={styles.fieldLabel}>Fulfilment</Text>
          <View style={styles.chipWrap}>
            <Chip
              label="Pick up from dealer"
              selected={spareFulfillment === 'PICKUP'}
              onPress={() => {
                setSpareFulfillment('PICKUP');
                clearError('location');
              }}
            />
            <Chip
              label="Deliver to me"
              selected={spareFulfillment === 'DELIVERY'}
              onPress={() => {
                setSpareFulfillment('DELIVERY');
                clearError('location');
              }}
            />
          </View>
          {spareFulfillment === 'PICKUP' ? (
            savedLocation ? (
              <SavedPlace
                place={savedLocation}
                detail="Dealers use this to judge distance. No delivery needed."
              />
            ) : (
              <LocationField
                label="Your location"
                value={location}
                placeholder="Set where you will collect the part"
                onPress={() => setPicker('pickup')}
                error={errors.location}
                hint="Needed to find dealers near you."
              />
            )
          ) : (
            <LocationField
              label="Delivery address"
              value={location ?? savedLocation}
              placeholder="Where should the part be delivered?"
              onPress={() => setPicker('pickup')}
              error={errors.location}
              hint={
                savedLocation && !location
                  ? `Using saved address · ${savedLocation.label ?? 'Saved'}`
                  : 'The dealer quotes delivery to this address.'
              }
            />
          )}
        </>
      ) : (
        <LocationField
          label={config.locationLabel}
          value={
            config.requiresExplicitLocation
              ? location
              : location ?? savedLocation
          }
          placeholder={
            config.requiresExplicitLocation
              ? `Set ${config.locationLabel.toLowerCase()}`
              : 'Choose a location'
          }
          onPress={() => setPicker('pickup')}
          error={errors.location}
          hint={
            !location && savedLocation && !config.requiresExplicitLocation
              ? `Using saved address · ${savedLocation.label ?? 'Saved'}`
              : config.locationHelp
          }
        />
      )}
    </>
  );
}
