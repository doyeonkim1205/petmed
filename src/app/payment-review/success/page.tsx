import { notFound } from 'next/navigation';
import SuccessClient from './SuccessClient';

export default function PaymentReviewSuccessPage() {
  if (process.env.ENABLE_PAYMENT_REVIEW !== 'true') {
    notFound();
  }
  return <SuccessClient />;
}
