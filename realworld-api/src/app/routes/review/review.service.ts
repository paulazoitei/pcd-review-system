import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore();

export const getReviewStatus = async (id: string) => {
  const doc = await firestore.collection('reviews').doc(id).get();

  if (!doc.exists) {
    return { status: 'pending' };
  }

  return doc.data();
};