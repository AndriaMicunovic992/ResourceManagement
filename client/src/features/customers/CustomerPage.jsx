import { useEffect, useState } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useData } from '../../contexts/DataContext';
import CustomerPageHeader from './CustomerPageHeader';
import CustomerPageTabs from './CustomerPageTabs';

export default function CustomerPage() {
  const { id } = useParams();
  const { loading: dataLoading } = useData();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api
      .getCustomerDetail(id)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (dataLoading || loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-6 text-center text-text-light text-sm">
        Loading…
      </div>
    );
  }

  if (notFound || !detail) {
    // Brief: 404-over-403 — unauthorized viewers get redirected the same as
    // a genuinely-missing customer.
    return <Navigate to="/planner" replace />;
  }

  const { customer, responsiblePerson } = detail;

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-6">
      <CustomerPageHeader customer={customer} responsiblePerson={responsiblePerson} />
      <CustomerPageTabs customerId={customer.id} />
      <Outlet context={{ customer, responsiblePerson }} />
    </div>
  );
}
