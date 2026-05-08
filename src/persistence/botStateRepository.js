import prisma from './prismaClient.js';

export async function get() {
  const state = await prisma.botState.findUnique({ where: { id: 1 } });
  if (!state) throw new Error('BotState no inicializado');
  return state;
}

export async function update(data) {
  return prisma.botState.update({ where: { id: 1 }, data });
}
