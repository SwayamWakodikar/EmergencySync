import prisma from '../prisma.js'
import { completion } from '../services/completion.controller.js'
// simple distance calculation (good enough for city scale)
function distance(a, b) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return Math.sqrt(dx * dx + dy * dy)
}

export async function assignment(emergencyId) {
  return prisma.$transaction(async (tx) => {
    const emergency = await tx.emergencyu.findUnique({
      where: { id: emergencyId },
    })
    console.log(" assignEmergency called with ID:", emergencyId)


    if (!emergency || emergency.status !== 'WAITING') {
      return null
    }

    const ambulances = await tx.ambulance.findMany({
      where: { status: 'FREE' },
    })

    if (ambulances.length === 0) {
      return null
    }

    let nearest = ambulances[0]
    let minDist = distance(nearest, emergency)

    for (const amb of ambulances.slice(1)) {
      const d = distance(amb, emergency)
      if (d < minDist) {
        minDist = d
        nearest = amb
      }
    }

    await tx.ambulance.update({
      where: { id: nearest.id },
      data: { status: 'ASSIGNED' },
    })

    await tx.emergencyu.update({
      where: { id: emergency.id },
      data: { status: 'ASSIGNED' },
    })

    const assignment = await tx.assignment.create({
      data: {
        ambulanceId: nearest.id,
        emergencyId: emergency.id,
      },
    })
    completion(nearest.id,emergency.id,minDist);

    console.log(
      `🚑 Assigned ambulance ${nearest.id} → emergency ${emergency.id}`
    )

    return assignment;
  })
}
