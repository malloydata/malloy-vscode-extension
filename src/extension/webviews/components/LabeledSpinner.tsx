/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import styled, {keyframes} from 'styled-components';
import SpinnerSVG from '../assets/spinner.svg';

export interface LabeledSpinnerProps {
  text: string;
}

export const LabeledSpinner: React.FC<LabeledSpinnerProps> = ({text}) => {
  return (
    <VerticalCenter>
      <HorizontalCenter>
        <Label>{text}</Label>
        <SpinningSVG>
          <SpinnerSVG />
        </SpinningSVG>
      </HorizontalCenter>
    </VerticalCenter>
  );
};

const rotation = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(359deg);
  }
`;

const SpinningSVG = styled.div`
  width: 25px;
  height: 25px;
  animation: ${rotation} 2s infinite linear;
`;

const Label = styled.div`
  margin-bottom: 10px;
  color: var(--malloy-title-color, #505050);
  font-size: 15px;
`;

const VerticalCenter = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1 0 auto;
  width: 100%;
  height: 100%;
`;

const HorizontalCenter = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;
