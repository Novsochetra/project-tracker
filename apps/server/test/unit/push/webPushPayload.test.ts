import { createECDH } from 'node:crypto';
import { expect, it } from 'vitest';
import { encryptPushPayload, pushIkm } from '../../../src/push/webPushPayload';

const b64 = (text: string) => Buffer.from(text, 'base64url');

// RFC 8291 Appendix A.
const RECEIVER = {
  p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
};

function rfcSender() {
  const sender = createECDH('prime256v1');
  sender.setPrivateKey(b64('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'));
  return sender;
}

it('derives the input keying material of the RFC 8291 example', () => {
  expect(pushIkm(RECEIVER, rfcSender()).toString('base64url')).toBe(
    'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg',
  );
});

it('encrypts the RFC 8291 example to the message body the RFC gives', () => {
  const body = encryptPushPayload(
    RECEIVER,
    Buffer.from('When I grow up, I want to be a watermelon'),
    { sender: rfcSender(), salt: b64('DGv6ra1nlYgDCS1FRnbzlw') },
  );
  expect(body.toString('base64url')).toBe(
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
      'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
      'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
});

it('uses a new key and salt for every message', () => {
  const plaintext = Buffer.from('hello');
  const first = encryptPushPayload(RECEIVER, plaintext);
  const second = encryptPushPayload(RECEIVER, plaintext);
  expect(first.subarray(0, 16)).not.toEqual(second.subarray(0, 16));
  expect(first.subarray(21, 86)).not.toEqual(second.subarray(21, 86));
});
