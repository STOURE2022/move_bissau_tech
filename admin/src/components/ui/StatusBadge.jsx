import clsx from 'clsx'

const statusStyles = {
  // Chauffeurs
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  // Courses
  driver_assigned: 'bg-blue-100 text-blue-800',
  driver_en_route: 'bg-blue-100 text-blue-800',
  driver_arrived: 'bg-indigo-100 text-indigo-800',
  passenger_onboard: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
  // Incidents
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  // Providers
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  // Priorité
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      statusStyles[status] || 'bg-gray-100 text-gray-800',
      className
    )}>
      {status}
    </span>
  )
}
