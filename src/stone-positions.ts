export type StonePosition =
  | {
      kind: "reserve";
      side: "left" | "right";
      index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    }
  | {
      kind: "lattice";
      leftIndex: 0 | 1 | 2 | 3 | 4;
      rightIndex: 0 | 1 | 2 | 3 | 4;
    }
  | {
      kind: "reveal";
      side: "left" | "right";
      index: 0 | 1 | 2 | 3 | 4;
    }
  | {
      kind: "swap";
      row: 0 | 1;
      col: 0 | 1 | 2 | 3 | 4 | 5;
    };

const STONE_COORDS = {
  reserve: {
    y: -0.044,
    left: [
      { x: 0.045, z: 0.137 },
      { x: 0.064, z: 0.137 },
      { x: 0.054, z: 0.122 },
      { x: 0.081, z: 0.132 },
      { x: 0.071, z: 0.117 },
      { x: 0.094, z: 0.119 },
      { x: 0.084, z: 0.105 },
      { x: 0.102, z: 0.103 },
    ],
    right: [
      // reserveRight is derived by inverting the z values of reserveLeft
      { x: 0.045, z: -0.137 },
      { x: 0.064, z: -0.137 },
      { x: 0.054, z: -0.122 },
      { x: 0.081, z: -0.132 },
      { x: 0.071, z: -0.117 },
      { x: 0.094, z: -0.119 },
      { x: 0.084, z: -0.105 },
      { x: 0.102, z: -0.103 },
    ],
  },
  board: {
    y: -0.019,
    lattice: [
      [
        { x: 0.003, z: 0.078 },
        { x: 0.018, z: 0.059 },
        { x: 0.031, z: 0.039 },
        { x: 0.045, z: 0.02 },
        { x: 0.059, z: 0.002 },
      ],
      [
        { x: -0.011, z: 0.06 },
        { x: 0.002, z: 0.041 },
        { x: 0.016, z: 0.021 },
        { x: 0.029, z: 0.002 },
        { x: 0.045, z: -0.017 },
      ],
      [
        { x: -0.026, z: 0.04 },
        { x: -0.012, z: 0.021 },
        { x: 0.001, z: 0.002 },
        { x: 0.016, z: -0.018 },
        { x: 0.031, z: -0.036 },
      ],
      [
        { x: -0.041, z: 0.021 },
        { x: -0.027, z: 0.001 },
        { x: -0.013, z: -0.018 },
        { x: 0.002, z: -0.037 },
        { x: 0.018, z: -0.054 },
      ],
      [
        { x: -0.054, z: 0.002 },
        { x: -0.041, z: -0.018 },
        { x: -0.026, z: -0.038 },
        { x: -0.011, z: -0.056 },
        { x: 0.005, z: -0.073 },
      ],
    ],
    reveal: {
      left: [
        { x: -0.009, z: 0.1 },
        { x: -0.029, z: 0.089 },
        { x: -0.049, z: 0.077 },
        { x: -0.07, z: 0.065 },
        { x: -0.089, z: 0.053 },
      ],
      right: [
        { x: -0.087, z: -0.05 },
        { x: -0.068, z: -0.062 },
        { x: -0.048, z: -0.075 },
        { x: -0.029, z: -0.085 },
        { x: -0.009, z: -0.096 },
      ],
    },
    swap: [
      [
        { x: 0.105, z: 0.049 },
        { x: 0.105, z: 0.03 },
        { x: 0.105, z: 0.012 },
        { x: 0.105, z: -0.007 },
        { x: 0.105, z: -0.026 },
        { x: 0.105, z: -0.045 },
      ],
      [
        { x: 0.087, z: 0.049 },
        { x: 0.087, z: 0.03 },
        { x: 0.087, z: 0.012 },
        { x: 0.087, z: -0.007 },
        { x: 0.087, z: -0.026 },
        { x: 0.087, z: -0.045 },
      ],
    ],
  },
};

export const getStoneCoords = (position: StonePosition) => {
  switch (position.kind) {
    case "reserve": {
      const xzcoords = STONE_COORDS.reserve[position.side][position.index];
      return { x: xzcoords.x, y: STONE_COORDS.reserve.y, z: xzcoords.z };
    }
    case "lattice": {
      const xzcoords =
        STONE_COORDS.board.lattice[position.leftIndex][position.rightIndex];
      return { x: xzcoords.x, y: STONE_COORDS.board.y, z: xzcoords.z };
    }
    case "reveal": {
      const xzcoords = STONE_COORDS.board.reveal[position.side][position.index];
      return { x: xzcoords.x, y: STONE_COORDS.board.y, z: xzcoords.z };
    }
    case "swap": {
      const xzcoords = STONE_COORDS.board.swap[position.row][position.col];
      return { x: xzcoords.x, y: STONE_COORDS.board.y, z: xzcoords.z };
    }
  }
};
