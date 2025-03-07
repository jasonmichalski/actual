import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useContext,
  type ReactNode,
} from 'react';
import { useSelector } from 'react-redux';
import { Routes, Route, useLocation } from 'react-router-dom';

import * as Platform from 'loot-core/src/client/platform';
import * as queries from 'loot-core/src/client/queries';
import { listen } from 'loot-core/src/platform/client/fetch';
import { type LocalPrefs } from 'loot-core/src/types/prefs';

import { useActions } from '../hooks/useActions';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useNavigate } from '../hooks/useNavigate';
import { SvgArrowLeft } from '../icons/v1';
import {
  SvgAlertTriangle,
  SvgNavigationMenu,
  SvgViewHide,
  SvgViewShow,
} from '../icons/v2';
import { useResponsive } from '../ResponsiveProvider';
import { theme, type CSSProperties, styles } from '../style';

import { AccountSyncCheck } from './accounts/AccountSyncCheck';
import { AnimatedRefresh } from './AnimatedRefresh';
import { MonthCountSelector } from './budget/MonthCountSelector';
import { Button, ButtonWithLoading } from './common/Button';
import { ExternalLink } from './common/ExternalLink';
import { Link } from './common/Link';
import { Paragraph } from './common/Paragraph';
import { Text } from './common/Text';
import { View } from './common/View';
import { KeyHandlers } from './KeyHandlers';
import { LoggedInUser } from './LoggedInUser';
import { useServerURL } from './ServerContext';
import { useSidebar } from './sidebar';
import { useSheetValue } from './spreadsheet/useSheetValue';
import { ThemeSelector } from './ThemeSelector';
import { Tooltip } from './tooltips';

export const SWITCH_BUDGET_MESSAGE_TYPE = 'budget/switch-type';

type SwitchBudgetTypeMessage = {
  type: typeof SWITCH_BUDGET_MESSAGE_TYPE;
  payload: {
    newBudgetType: LocalPrefs['budgetType'];
  };
};
export type TitlebarMessage = SwitchBudgetTypeMessage;

type Listener = (msg: TitlebarMessage) => void;
export type TitlebarContextValue = {
  sendEvent: (msg: TitlebarMessage) => void;
  subscribe: (listener: Listener) => () => void;
};

export const TitlebarContext = createContext<TitlebarContextValue>(null);

type TitlebarProviderProps = {
  children?: ReactNode;
};

export function TitlebarProvider({ children }: TitlebarProviderProps) {
  const listeners = useRef<Listener[]>([]);

  function sendEvent(msg: TitlebarMessage) {
    listeners.current.forEach(func => func(msg));
  }

  function subscribe(listener: Listener) {
    listeners.current.push(listener);
    return () =>
      (listeners.current = listeners.current.filter(func => func !== listener));
  }

  return (
    <TitlebarContext.Provider value={{ sendEvent, subscribe }}>
      {children}
    </TitlebarContext.Provider>
  );
}

function UncategorizedButton() {
  const count = useSheetValue(queries.uncategorizedCount());
  return (
    count !== 0 && (
      <Link
        variant="button"
        type="bare"
        to="/accounts/uncategorized"
        style={{
          color: theme.errorText,
        }}
      >
        {count} uncategorized {count === 1 ? 'transaction' : 'transactions'}
      </Link>
    )
  );
}

function PrivacyButton({ style }) {
  const isPrivacyEnabled = useSelector(
    state => state.prefs.local.isPrivacyEnabled,
  );
  const { savePrefs } = useActions();

  const privacyIconStyle = { width: 15, height: 15 };

  return (
    <Button
      type="bare"
      aria-label={`${isPrivacyEnabled ? 'Disable' : 'Enable'} privacy mode`}
      onClick={() => savePrefs({ isPrivacyEnabled: !isPrivacyEnabled })}
      style={style}
    >
      {isPrivacyEnabled ? (
        <SvgViewHide style={privacyIconStyle} />
      ) : (
        <SvgViewShow style={privacyIconStyle} />
      )}
    </Button>
  );
}

type SyncButtonProps = {
  style?: CSSProperties;
  isMobile?: boolean;
};
function SyncButton({ style, isMobile = false }: SyncButtonProps) {
  const cloudFileId = useSelector(state => state.prefs.local.cloudFileId);
  const { sync } = useActions();

  const [syncing, setSyncing] = useState(false);
  const [syncState, setSyncState] = useState(null);

  useEffect(() => {
    const unlisten = listen('sync-event', ({ type, subtype, syncDisabled }) => {
      if (type === 'start') {
        setSyncing(true);
        setSyncState(null);
      } else {
        // Give the layout some time to apply the starting animation
        // so we always finish it correctly even if it's almost
        // instant
        setTimeout(() => {
          setSyncing(false);
        }, 200);
      }

      if (type === 'error') {
        // Use the offline state if either there is a network error or
        // if this file isn't a "cloud file". You can't sync a local
        // file.
        if (subtype === 'network') {
          setSyncState('offline');
        } else if (!cloudFileId) {
          setSyncState('local');
        } else {
          setSyncState('error');
        }
      } else if (type === 'success') {
        setSyncState(syncDisabled ? 'disabled' : null);
      }
    });

    return unlisten;
  }, []);

  const mobileColor =
    syncState === 'error'
      ? theme.errorText
      : syncState === 'disabled' ||
        syncState === 'offline' ||
        syncState === 'local'
      ? theme.mobileHeaderTextSubdued
      : theme.mobileHeaderText;
  const desktopColor =
    syncState === 'error'
      ? theme.errorTextDark
      : syncState === 'disabled' ||
        syncState === 'offline' ||
        syncState === 'local'
      ? theme.tableTextLight
      : 'inherit';

  const activeStyle = isMobile
    ? {
        color: mobileColor,
      }
    : {};

  const hoveredStyle = isMobile
    ? {
        color: mobileColor,
        background: theme.mobileHeaderTextHover,
      }
    : {};

  const mobileIconStyle = {
    color: mobileColor,
    justifyContent: 'center',
    margin: 10,
    paddingLeft: 5,
    paddingRight: 3,
  };

  const mobileTextStyle = {
    ...styles.text,
    fontWeight: 500,
    marginLeft: 2,
    marginRight: 5,
  };

  return (
    <>
      <KeyHandlers
        keys={{
          'ctrl+s, cmd+s': () => {
            sync();
          },
        }}
      />

      <Button
        type="bare"
        aria-label="Sync"
        style={
          isMobile
            ? {
                ...style,
                WebkitAppRegion: 'none',
                ...mobileIconStyle,
              }
            : {
                ...style,
                WebkitAppRegion: 'none',
                color: desktopColor,
              }
        }
        hoveredStyle={hoveredStyle}
        activeStyle={activeStyle}
        onClick={sync}
      >
        {isMobile ? (
          syncState === 'error' ? (
            <SvgAlertTriangle width={14} height={14} />
          ) : (
            <AnimatedRefresh width={18} height={18} animating={syncing} />
          )
        ) : syncState === 'error' ? (
          <SvgAlertTriangle width={13} />
        ) : (
          <AnimatedRefresh animating={syncing} />
        )}
        <Text style={isMobile ? { ...mobileTextStyle } : { marginLeft: 3 }}>
          {syncState === 'disabled'
            ? 'Disabled'
            : syncState === 'offline'
            ? 'Offline'
            : 'Sync'}
        </Text>
      </Button>
    </>
  );
}

function BudgetTitlebar() {
  const maxMonths = useSelector(state => state.prefs.global.maxMonths);
  const budgetType = useSelector(state => state.prefs.local.budgetType);
  const { saveGlobalPrefs } = useActions();
  const { sendEvent } = useContext(TitlebarContext);

  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const reportBudgetEnabled = useFeatureFlag('reportBudget');

  function onSwitchType() {
    setLoading(true);
    if (!loading) {
      const newBudgetType = budgetType === 'rollover' ? 'report' : 'rollover';
      sendEvent({
        type: SWITCH_BUDGET_MESSAGE_TYPE,
        payload: {
          newBudgetType,
        },
      });
    }
  }

  useEffect(() => {
    setLoading(false);
  }, [budgetType]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <MonthCountSelector
        maxMonths={maxMonths || 1}
        onChange={value => saveGlobalPrefs({ maxMonths: value })}
      />
      {reportBudgetEnabled && (
        <View style={{ marginLeft: -5 }}>
          <ButtonWithLoading
            type="bare"
            loading={loading}
            style={{
              alignSelf: 'flex-start',
              padding: '4px 7px',
            }}
            title="Learn more about budgeting"
            onClick={() => setShowTooltip(true)}
          >
            {budgetType === 'report' ? 'Report budget' : 'Rollover budget'}
          </ButtonWithLoading>
          {showTooltip && (
            <Tooltip
              position="bottom-left"
              onClose={() => setShowTooltip(false)}
              style={{
                padding: 10,
                maxWidth: 400,
              }}
            >
              <Paragraph>
                You are currently using a{' '}
                <Text style={{ fontWeight: 600 }}>
                  {budgetType === 'report'
                    ? 'Report budget'
                    : 'Rollover budget'}
                  .
                </Text>{' '}
                Switching will not lose any data and you can always switch back.
              </Paragraph>
              <Paragraph>
                <ButtonWithLoading
                  type="primary"
                  loading={loading}
                  onClick={onSwitchType}
                >
                  Switch to a{' '}
                  {budgetType === 'report'
                    ? 'Rollover budget'
                    : 'Report budget'}
                </ButtonWithLoading>
              </Paragraph>
              <Paragraph isLast={true}>
                <ExternalLink
                  to="https://actualbudget.org/docs/experimental/report-budget"
                  linkColor="muted"
                >
                  How do these types of budgeting work?
                </ExternalLink>
              </Paragraph>
            </Tooltip>
          )}
        </View>
      )}
    </View>
  );
}

export function Titlebar({ style }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebar = useSidebar();
  const { isNarrowWidth } = useResponsive();
  const serverURL = useServerURL();
  const floatingSidebar = useSelector(
    state => state.prefs.global.floatingSidebar,
  );

  return isNarrowWidth ? null : (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 15px',
        height: 36,
        pointerEvents: 'none',
        '& *': {
          pointerEvents: 'auto',
        },
        ...(!Platform.isBrowser &&
          Platform.OS === 'mac' &&
          floatingSidebar && { paddingLeft: 80 }),
        ...style,
      }}
    >
      {(floatingSidebar || sidebar.alwaysFloats) && (
        <Button
          type="bare"
          style={{ marginRight: 8 }}
          onPointerEnter={e => {
            if (e.pointerType === 'mouse') {
              sidebar.setHidden(false);
            }
          }}
          onPointerLeave={e => {
            if (e.pointerType === 'mouse') {
              sidebar.setHidden(true);
            }
          }}
          onPointerUp={e => {
            if (e.pointerType !== 'mouse') {
              sidebar.setHidden(!sidebar.hidden);
            }
          }}
        >
          <SvgNavigationMenu
            className="menu"
            style={{ width: 15, height: 15, color: theme.pageText, left: 0 }}
          />
        </Button>
      )}

      <Routes>
        <Route
          path="/accounts"
          element={
            location.state?.goBack ? (
              <Button type="bare" onClick={() => navigate(-1)}>
                <SvgArrowLeft
                  width={10}
                  height={10}
                  style={{ marginRight: 5, color: 'currentColor' }}
                />{' '}
                Back
              </Button>
            ) : null
          }
        />

        <Route path="/accounts/:id" element={<AccountSyncCheck />} />

        <Route path="/budget" element={<BudgetTitlebar />} />

        <Route path="*" element={null} />
      </Routes>
      <View style={{ flex: 1 }} />
      <UncategorizedButton />
      <ThemeSelector style={{ marginLeft: 10 }} />
      <PrivacyButton style={{ marginLeft: 10 }} />
      {serverURL ? <SyncButton style={{ marginLeft: 10 }} /> : null}
      <LoggedInUser style={{ marginLeft: 10 }} />
    </View>
  );
}
