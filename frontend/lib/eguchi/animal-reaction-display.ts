export type AnimalReactionDisplayState = {
  canDisplayPose: boolean;
  shouldMountPose: boolean;
  shouldPreloadPose: boolean;
};

export function getAnimalReactionDisplayState(
  poseKey: string | null,
  loadedPoseKey: string | null,
  failedPoseKey: string | null
): AnimalReactionDisplayState {
  if (!poseKey || failedPoseKey === poseKey) {
    return { canDisplayPose: false, shouldMountPose: false, shouldPreloadPose: false };
  }

  const canDisplayPose = loadedPoseKey === poseKey;
  return {
    canDisplayPose,
    shouldMountPose: true,
    shouldPreloadPose: !canDisplayPose,
  };
}
