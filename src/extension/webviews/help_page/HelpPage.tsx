/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as React from 'react';
import {VSCodeButton} from '@vscode/webview-ui-toolkit/react';
import styled from 'styled-components';

export interface ButtonLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
}

const ButtonLinkRaw = ({children, className, href}: ButtonLinkProps) => {
  return (
    <div className={className}>
      <a href={href}>
        <VSCodeButton>{children}</VSCodeButton>
      </a>
    </div>
  );
};

export const ButtonLink = styled(ButtonLinkRaw)`
  display: block;
  width: 100%;

  a {
    text-decoration: none;
    width: 100%;
  }

  vscode-button {
    height: 26px;
    width: 100%;
  }
`;

export interface HelpPageProps {
  className?: string;
}

const HelpPageRaw = ({className}: HelpPageProps) => {
  return (
    <div className={className}>
      <div className="view">
        <div className="help">
          <h3 id="about-malloy">About Malloy</h3>
          <p>
            Malloy is an open source language for describing data relationships
            and transformations. It is both a semantic modeling language and a
            querying language that runs queries against a relational database.
            Malloy currently supports PostgreSQL, MySQL, BigQuery, SnowFlake,
            MotherDuck, DuckDb, Presto and Trino.
            <br />
            <br />
            The installed Visual Studio Code extension supports building Malloy
            data models, querying and transforming data, and creating simple
            visualizations and dashboards.
          </p>
        </div>
        <div className="help">
          <h3>Malloy Resources</h3>
        </div>

        <ButtonLink href="https://docs.malloydata.dev/documentation/user_guides/basic.html">
          Quick Start Guide
        </ButtonLink>
        <ButtonLink href="https://docs.malloydata.dev/documentation/language/sql_to_malloy.html">
          Language Reference
        </ButtonLink>
        <ButtonLink href="https://github.com/malloydata/malloy-samples/archive/refs/heads/main.zip">
          Download Sample Models
        </ButtonLink>
        <ButtonLink href="https://docs.malloydata.dev/documentation/index.html">
          View Documentation
        </ButtonLink>
      </div>
    </div>
  );
};

export const HelpPage = styled(HelpPageRaw)`
  display: block;

  .view {
    padding: 1em 20px 1em;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .help {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  ${ButtonLink} {
    width: 100%;
    max-width: 300px;
  }
`;
