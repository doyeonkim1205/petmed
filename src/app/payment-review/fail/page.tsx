import { notFound } from 'next/navigation';
import FailClient from './FailClient';

export default function PaymentReviewFailPage() {
  if (process.env.ENABLE_PAYMENT_REVIEW !== 'true') {
    notFound();
  }
  return <FailClient />;
}
