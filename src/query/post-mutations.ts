import { useMutation } from '@tanstack/react-query';
import { post, uploadPhoto } from '@/auth/fanfou-client';

type FanfouPostParams = Record<string, string | number | boolean | undefined>;

export const postMutationKeys = {
  statusUpdate: ['post', 'status-update'] as const,
  directMessageSend: ['post', 'direct-message-send'] as const,
};

export type StatusUpdateMutationVariables = {
  status?: string;
  photoBase64?: string;
  params?: FanfouPostParams;
};

const sendStatusUpdate = async ({
  status,
  photoBase64,
  params,
}: StatusUpdateMutationVariables): Promise<unknown> => {
  if (photoBase64) {
    return uploadPhoto({
      photoBase64,
      status,
      params,
    });
  }

  return post('/statuses/update', {
    status,
    ...params,
  });
};

export const useStatusUpdateMutation = () =>
  useMutation({
    mutationKey: postMutationKeys.statusUpdate,
    mutationFn: sendStatusUpdate,
  });

export type DirectMessageMutationVariables = {
  userId: string;
  text: string;
};

const sendDirectMessage = async ({
  userId,
  text,
}: DirectMessageMutationVariables): Promise<unknown> =>
  post('/direct_messages/new', {
    user: userId,
    text,
  });

export const useDirectMessageMutation = () =>
  useMutation({
    mutationKey: postMutationKeys.directMessageSend,
    mutationFn: sendDirectMessage,
  });
