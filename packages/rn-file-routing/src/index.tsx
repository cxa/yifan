import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { FileRouterOptions, RouteNode } from './types';

const getInitialRouteName = (node: RouteNode) => {
  const indexChild = node.children.find(child => child.isIndex);
  if (indexChild) {
    return indexChild.name;
  }

  const firstRoutableChild = node.children.find(
    child => child.component || child.children.length > 0,
  );
  return firstRoutableChild?.name;
};

const createScreenComponent = (
  Component: RouteNode['component'] | undefined,
  NestedNavigator: React.ComponentType<{
    parentParams?: Record<string, unknown>;
  }> | null,
) => {
  type ScreenProps = {
    route?: { params?: unknown };
  } & Record<string, unknown>;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const hasParams = (
    value: unknown,
  ): value is { params?: Record<string, unknown> } =>
    isRecord(value) && 'params' in value;

  const ScreenComponent = (props: ScreenProps) => {
    const routeParams = props.route?.params;
    const nestedParams = hasParams(routeParams)
      ? routeParams.params
      : routeParams;
    const parentParams = isRecord(nestedParams) ? nestedParams : undefined;
    if (Component) {
      return (
        <Component {...props}>
          {NestedNavigator ? (
            <NestedNavigator parentParams={parentParams} />
          ) : null}
        </Component>
      );
    }

    if (NestedNavigator) {
      return <NestedNavigator parentParams={parentParams} />;
    }

    return null;
  };

  ScreenComponent.displayName = 'FileRouteScreen';

  return ScreenComponent;
};

const buildNavigator = (
  node: RouteNode,
  options: Pick<FileRouterOptions, 'screenOptions' | 'stackOptions'>,
) => {
  const Stack = createNativeStackNavigator();

  const Navigator = ({
    parentParams,
  }: {
    parentParams?: Record<string, unknown>;
  }) => {
    const initialRouteName = getInitialRouteName(node);
    return (
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={options.screenOptions}
        {...options.stackOptions}
      >
        {node.children
          .filter(child => child.component || child.children.length > 0)
          .map(child => {
            const ChildNavigator =
              child.children.length > 0 ? buildNavigator(child, options) : null;
            const ScreenComponent = createScreenComponent(
              child.component,
              ChildNavigator,
            );

            return (
              <Stack.Screen
                key={child.id}
                name={child.name}
                component={ScreenComponent}
                initialParams={parentParams}
              />
            );
          })}
      </Stack.Navigator>
    );
  };

  Navigator.displayName = `FileRouteNavigator(${node.id})`;

  return Navigator;
};

export const createFileRouter = (options: FileRouterOptions) => {
  const RootNavigator = buildNavigator(options.routeTree, {
    screenOptions: options.screenOptions,
    stackOptions: options.stackOptions,
  });

  const RootComponent = options.routeTree.component;

  const Router = () => (
    <NavigationContainer {...options.navigationContainerProps}>
      {RootComponent ? (
        <RootComponent>
          <RootNavigator />
        </RootComponent>
      ) : (
        <RootNavigator />
      )}
    </NavigationContainer>
  );

  Router.displayName = 'FileRouter';

  return Router;
};

export type { FileRouterOptions, RouteNode } from './types';
