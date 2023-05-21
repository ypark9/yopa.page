---
title: The Observer Pattern
date: 2023-05-19T01:25:00-04:00
author: Yoonsoo Park
description: "The Observer Pattern - design pattern"
categories:
  - Design Pattern
tags:
  - The Observer Pattern
---

# Understanding the Observer Pattern in TypeScript: A Comprehensive Guide

The Observer pattern is a design pattern in which an object, known as the **subject**, maintains a list of its dependents, called **observers**, and notifies them automatically of any state changes, typically by calling one of their methods.

This pattern is particularly useful when you want to ensure multiple parts of your application are notified when another part changes. It fosters a degree of loose coupling between different parts of an application.

## How does the Observer Pattern Work?

Let's break down the main components of the Observer pattern:

- **Subject**: The subject holds the state and oversees the observers. It provides the methods to register and unregister observers. Moreover, it has a method to notify all observers of a state change.

- **Observer**: Observers are objects that follow the state of the subject. They expose a method that gets called when the subject's state changes.

- **Concrete Subject**: It's the object having the state that other objects are interested in. It extends the Subject class.

- **Concrete Observer**: These are the real objects that are observing the state. They extend the Observer class.

## Example with TypeScript

```typescript
interface Subject {
  registerObserver(o: Observer): void;
  removeObserver(o: Observer): void;
  notifyObservers(): void;
}

interface Observer {
  update(temperature: number): void;
}

class WeatherStation implements Subject {
  private temperature: number;
  private observers: Observer[] = [];

  setTemperature(temp: number) {
    console.log('WeatherStation: new temperature measurement: ' + temp);
    this.temperature = temp;
    this.notifyObservers();
  }

  registerObserver(o: Observer) {
    this.observers.push(o);
  }

  removeObserver(o: Observer) {
    let index = this.observers.indexOf(o);
    this.observers.splice(index, 1);
  }

  notifyObservers() {
    for (let observer of this.observers) {
      observer.update(this.temperature);
    }
  }
}

class TemperatureDisplay implements Observer {
  private subject: Subject;

  constructor(weatherStation: Subject) {
    this.subject = weatherStation;
    weatherStation.registerObserver(this);
  }

  public update(temperature: number) {
    console.log('TemperatureDisplay: I need to update my display');
    // Logic would go here
  }
}

let weatherStation = new WeatherStation();
let tempDisplay = new TemperatureDisplay(weatherStation);
weatherStation.setTemperature(20);
```

In the example above, the `WeatherStation` is the subject that maintains the list of observers and notifies them of any changes. `TemperatureDisplay` is the observer that gets notified of the changes.

The observer pattern is a powerful tool to have in your programming toolkit. It allows you to build flexible and modular systems that can handle changes and updates easily.

Cheers! 🍺
