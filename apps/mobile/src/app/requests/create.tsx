import { RequestWizard } from '@/components/requests/RequestWizard';

/**
 * New request — one route, six service-specific flows.
 *
 * The category comes from Home, SOS or the packages list. Without one, the
 * wizard starts on its own service picker. All flows share the same API
 * submission path and only render the fields their service needs.
 */
export default function CreateRequestScreen() {
  return <RequestWizard />;
}
