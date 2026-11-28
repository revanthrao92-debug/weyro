import { SectionHead } from '@/components/ui';
import { VehicleSelector } from '../VehicleSelector';
import { type ManualVehicle, type RequestErrorMap } from '../serviceRequestConfig';

import type { ComponentProps, Dispatch, SetStateAction } from 'react';

export function VehicleSection({ vehicles, vehiclesQuery, effectiveVehicleMode, selectedVehicle, manualVehicle, errors, setVehicleMode, setSelectedVehicleId, setManualVehicle, clearVehicleErrors }: {
  vehicles: ComponentProps<typeof VehicleSelector>['vehicles'];
  vehiclesQuery: { isError: boolean };
  effectiveVehicleMode: 'saved' | 'manual' | 'loading';
  selectedVehicle: { id: string } | null;
  manualVehicle: ManualVehicle;
  errors: RequestErrorMap;
  setVehicleMode: (mode: 'saved' | 'manual') => void;
  setSelectedVehicleId: (id: string | null) => void;
  setManualVehicle: Dispatch<SetStateAction<ManualVehicle>>;
  clearVehicleErrors: () => void;
}) {
  return (
    <>
      <SectionHead title="Vehicle" />
      <VehicleSelector
        vehicles={vehicles}
        isError={vehiclesQuery.isError}
        mode={effectiveVehicleMode}
        selectedId={selectedVehicle?.id ?? null}
        manual={manualVehicle}
        errors={errors}
        onSelect={(id) => {
          setVehicleMode('saved');
          setSelectedVehicleId(id);
          clearVehicleErrors();
        }}
        onManual={() => {
          setVehicleMode('manual');
          clearVehicleErrors();
        }}
        onSaved={() => {
          setVehicleMode('saved');
          clearVehicleErrors();
        }}
        onManualChange={(patch) => {
          setManualVehicle((current) => ({ ...current, ...patch }));
          clearVehicleErrors();
        }}
      />
    </>
  );
}
